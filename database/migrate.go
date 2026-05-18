package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

const (
	defaultMySQLDSN      = "root:1234@tcp(localhost:3306)/fifam_dev?parseTime=true"
	defaultAPIHost       = "v3.football.api-sports.io"
	defaultRapidAPIKey   = "bb2298594195e93d3891a738150db6a1"
	defaultCountry       = "england"
	defaultLeague        = "39"
	defaultSeason        = "2024"
	defaultPlayerStat    = 60
	defaultPlayerHeight  = 170
	unknownCountryID     = int64(168)
	defaultRequestTimout = 30 * time.Second
)

type config struct {
	MySQLDSN    string
	APIKey      string
	RapidAPIKey string
	APIHost     string
	Country     string
	League      string
	Season      string
}

type teamsResponse struct {
	Paging struct {
		Current int `json:"current"`
		Total   int `json:"total"`
	} `json:"paging"`
	Response []struct {
		Team struct {
			ID      int64  `json:"id"`
			Name    string `json:"name"`
			Country string `json:"country"`
			Logo    string `json:"logo"`
		} `json:"team"`
	} `json:"response"`
}

type squadResponse struct {
	Response []struct {
		Players []struct {
			Name     string `json:"name"`
			Position string `json:"position"`
			Photo    string `json:"photo"`
		} `json:"players"`
	} `json:"response"`
}

type clubSeed struct {
	ID         int64
	Name       string
	Logo       string
	Country    string
	LeagueName string
}

func main() {
	cfg := loadConfig()
	if strings.TrimSpace(cfg.APIKey) == "" && strings.TrimSpace(cfg.RapidAPIKey) == "" {
		log.Fatal("missing API key: set API_FOOTBALL_KEY/APISPORTS_KEY or RAPIDAPI_KEY")
	}

	db, err := sql.Open("mysql", cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("open mysql: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping mysql: %v", err)
	}

	client := &http.Client{Timeout: defaultRequestTimout}

	if err := ensureCountryID(ctx, db, unknownCountryID); err != nil {
		log.Fatalf("ensure unknown country id: %v", err)
	}

	clubs, err := fetchPremierLeagueClubs(ctx, client, cfg)
	if err != nil {
		log.Fatalf("fetch clubs: %v", err)
	}
	if len(clubs) == 0 {
		log.Fatal("no clubs returned from API")
	}

	clubCount := 0
	playerCount := 0
	for _, club := range clubs {
		if err := upsertClub(ctx, db, club); err != nil {
			log.Fatalf("upsert club %d (%s): %v", club.ID, club.Name, err)
		}
		clubCount++

		players, err := fetchSquadPlayers(ctx, client, cfg, club.ID)
		if err != nil {
			log.Fatalf("fetch squad team=%d: %v", club.ID, err)
		}

		for _, p := range players {
			if err := upsertPlayerTemplate(ctx, db, club, p); err != nil {
				log.Fatalf("upsert player %q team=%d: %v", p.Name, club.ID, err)
			}
			playerCount++
		}

		log.Printf("seeded team=%d club=%q players=%d", club.ID, club.Name, len(players))
	}

	log.Printf("done: clubs=%d player_templates=%d", clubCount, playerCount)
}

func loadConfig() config {
	apiKey := strings.TrimSpace(firstNonEmpty(
		os.Getenv("API_FOOTBALL_KEY"),
		os.Getenv("APISPORTS_KEY"),
		os.Getenv("X_APISPORTS_KEY"),
	))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("X-APISPORTS-KEY"))
	}

	return config{
		MySQLDSN: firstNonEmpty(os.Getenv("MYSQL_DSN"), defaultMySQLDSN),
		APIKey:   apiKey,
		RapidAPIKey: firstNonEmpty(
			os.Getenv("API_FOOTBALL_KEY"),
			defaultRapidAPIKey,
		),
		APIHost: firstNonEmpty(os.Getenv("API_FOOTBALL_HOST"), defaultAPIHost),
		Country: firstNonEmpty(os.Getenv("API_FOOTBALL_COUNTRY"), defaultCountry),
		League:  firstNonEmpty(os.Getenv("API_FOOTBALL_LEAGUE"), defaultLeague),
		Season:  firstNonEmpty(os.Getenv("API_FOOTBALL_SEASON"), defaultSeason),
	}
}

func fetchPremierLeagueClubs(ctx context.Context, client *http.Client, cfg config) ([]clubSeed, error) {
	out := make([]clubSeed, 0, 20)
	seen := make(map[int64]struct{}, 20)

	page := 1
	for {
		query := url.Values{}
		query.Set("country", cfg.Country)
		query.Set("league", cfg.League)
		query.Set("season", cfg.Season)

		endpoint := fmt.Sprintf("https://%s/teams?%s", cfg.APIHost, query.Encode())
		var payload teamsResponse
		if err := requestJSON(ctx, client, cfg, endpoint, &payload); err != nil {
			return nil, err
		}

		for _, item := range payload.Response {
			id := item.Team.ID
			name := strings.TrimSpace(item.Team.Name)
			if id <= 0 || name == "" {
				continue
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			out = append(out, clubSeed{
				ID:         id,
				Name:       name,
				Logo:       strings.TrimSpace(item.Team.Logo),
				Country:    strings.TrimSpace(item.Team.Country),
				LeagueName: "Premier League",
			})
		}

		total := payload.Paging.Total
		if total <= 1 || page >= total {
			break
		}
		page++
	}

	return out, nil
}

func fetchSquadPlayers(ctx context.Context, client *http.Client, cfg config, teamID int64) ([]squadPlayer, error) {
	query := url.Values{}
	query.Set("team", fmt.Sprintf("%d", teamID))

	endpoint := fmt.Sprintf("https://%s/players/squads?%s", cfg.APIHost, query.Encode())
	var payload squadResponse
	if err := requestJSON(ctx, client, cfg, endpoint, &payload); err != nil {
		return nil, err
	}

	if len(payload.Response) == 0 {
		return nil, nil
	}

	seen := make(map[string]struct{}, len(payload.Response[0].Players))
	out := make([]squadPlayer, 0, len(payload.Response[0].Players))
	for _, p := range payload.Response[0].Players {
		name := strings.TrimSpace(p.Name)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		out = append(out, squadPlayer{
			Name:     name,
			Position: strings.TrimSpace(p.Position),
			Photo:    strings.TrimSpace(p.Photo),
		})
	}

	return out, nil
}

func requestJSON(ctx context.Context, client *http.Client, cfg config, endpoint string, out any) error {
	var lastErr error
	for attempt := 1; attempt <= 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			return err
		}
		req.Header.Set("X-RAPIDAPI-KEY", cfg.RapidAPIKey)

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			time.Sleep(time.Duration(attempt) * 400 * time.Millisecond)
			continue
		}

		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return readErr
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if err := json.Unmarshal(body, out); err != nil {
				return fmt.Errorf("decode response: %w", err)
			}
			return nil
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("status=%d body=%s", resp.StatusCode, string(body))
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
			continue
		}

		return fmt.Errorf("status=%d body=%s", resp.StatusCode, string(body))
	}

	if lastErr == nil {
		lastErr = errors.New("request failed")
	}
	return lastErr
}

func upsertClub(ctx context.Context, db *sql.DB, club clubSeed) error {
	countryID, err := resolveOrCreateCountry(ctx, db, club.Country)
	if err != nil {
		return err
	}

	leagueID, err := resolveOrCreateLeague(ctx, db, club.LeagueName, countryID)
	if err != nil {
		return err
	}

	_, err = db.ExecContext(ctx, `
INSERT INTO clubs (id, name, logo, country_id, league_id, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  logo = VALUES(logo),
  country_id = VALUES(country_id),
  league_id = VALUES(league_id),
  updated_at = NOW()`,
		club.ID,
		club.Name,
		club.Logo,
		countryID,
		leagueID,
	)
	return err
}

type squadPlayer struct {
	Name     string
	Position string
	Photo    string
}

func upsertPlayerTemplate(ctx context.Context, db *sql.DB, club clubSeed, player squadPlayer) error {
	var existingID int64
	err := db.QueryRowContext(ctx, `
SELECT id
FROM player_templates
WHERE club_id = ?
  AND season = 'normal'
  AND LOWER(name) = LOWER(?)
LIMIT 1`, club.ID, player.Name).Scan(&existingID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	if errors.Is(err, sql.ErrNoRows) {
		result, insertErr := db.ExecContext(ctx, `
INSERT INTO player_templates (
  name,
  height_cm,
  country_id,
  club_id,
  base_club,
  season,
  image_url,
  base_shooting,
  base_passing,
  base_long_pass,
  base_vision,
  base_gk_reach,
  base_counter_attack_awareness,
  base_defending,
  base_gk_parrying,
  base_gk_reflex,
  base_duels,
  base_pace,
  base_stamina,
  base_balance,
  base_technique,
  base_determination,
  base_physical,
  base_standing_tackle,
  base_sliding_tackle,
  base_dribbling,
  base_curve,
  created_at,
  updated_at
) VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
			player.Name,
			defaultPlayerHeight,
			unknownCountryID,
			club.ID,
			club.Name,
			player.Photo,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
		)
		if insertErr != nil {
			return insertErr
		}
		insertedID, idErr := result.LastInsertId()
		if idErr == nil && insertedID > 0 {
			existingID = insertedID
		}
	} else {
		_, err = db.ExecContext(ctx, `
UPDATE player_templates
SET
  name = ?,
  height_cm = ?,
  country_id = ?,
  club_id = ?,
  base_club = ?,
  season = 'normal',
  image_url = ?,
  base_shooting = ?,
  base_passing = ?,
  base_long_pass = ?,
  base_vision = ?,
  base_gk_reach = ?,
  base_counter_attack_awareness = ?,
  base_defending = ?,
  base_gk_parrying = ?,
  base_gk_reflex = ?,
  base_duels = ?,
  base_pace = ?,
  base_stamina = ?,
  base_balance = ?,
  base_technique = ?,
  base_determination = ?,
  base_physical = ?,
  base_standing_tackle = ?,
  base_sliding_tackle = ?,
  base_dribbling = ?,
  base_curve = ?,
  updated_at = NOW()
WHERE id = ?`,
			player.Name,
			defaultPlayerHeight,
			unknownCountryID,
			club.ID,
			club.Name,
			player.Photo,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			defaultPlayerStat,
			existingID,
		)
		if err != nil {
			return err
		}
	}

	if existingID > 0 {
		if err := upsertPrimaryPosition(ctx, db, existingID, player.Position); err != nil {
			return err
		}
	}

	return nil
}

func upsertPrimaryPosition(ctx context.Context, db *sql.DB, playerTemplateID int64, apiPosition string) error {
	position := mapPosition(apiPosition)
	if position == "" {
		return nil
	}

	_, err := db.ExecContext(ctx, `
INSERT INTO player_positions (player_template_id, position, effect, created_at, updated_at)
VALUES (?, ?, 1.00, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  effect = VALUES(effect),
  updated_at = NOW()`,
		playerTemplateID,
		position,
	)
	return err
}

func mapPosition(apiPosition string) string {
	switch strings.ToLower(strings.TrimSpace(apiPosition)) {
	case "goalkeeper":
		return "GK"
	case "defender":
		return "CB"
	case "midfielder":
		return "CM"
	case "attacker", "forward", "striker":
		return "CF"
	default:
		return ""
	}
}

func resolveOrCreateCountry(ctx context.Context, db *sql.DB, countryName string) (*uint64, error) {
	name := strings.TrimSpace(countryName)
	if name == "" {
		return nil, nil
	}

	var id uint64
	err := db.QueryRowContext(ctx, `SELECT id FROM countries WHERE name = ? LIMIT 1`, name).Scan(&id)
	if err == nil {
		return &id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	code := inferCountryCode(name)
	res, err := db.ExecContext(ctx, `
INSERT INTO countries (name, code, flag, created_at, updated_at)
VALUES (?, ?, '', NOW(), NOW())`, name, code)
	if err != nil {
		return nil, err
	}

	newID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	cast := uint64(newID)
	return &cast, nil
}

func resolveOrCreateLeague(ctx context.Context, db *sql.DB, leagueName string, countryID *uint64) (*uint64, error) {
	name := strings.TrimSpace(leagueName)
	if name == "" {
		return nil, nil
	}

	var id uint64
	err := db.QueryRowContext(ctx, `
SELECT id
FROM leagues
WHERE name = ?
  AND ((country_id IS NULL AND ? IS NULL) OR country_id = ?)
LIMIT 1`, name, countryID, countryID).Scan(&id)
	if err == nil {
		return &id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}

	res, err := db.ExecContext(ctx, `
INSERT INTO leagues (name, country_id, logo, created_at, updated_at)
VALUES (?, ?, '', NOW(), NOW())`, name, countryID)
	if err != nil {
		return nil, err
	}

	newID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	cast := uint64(newID)
	return &cast, nil
}

func ensureCountryID(ctx context.Context, db *sql.DB, id int64) error {
	var exists int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM countries WHERE id = ?`, id).Scan(&exists); err != nil {
		return err
	}
	if exists > 0 {
		return nil
	}

	_, err := db.ExecContext(ctx, `
INSERT INTO countries (id, name, code, flag, created_at, updated_at)
VALUES (?, ?, ?, '', NOW(), NOW())`, id, fmt.Sprintf("Unknown (%d)", id), fmt.Sprintf("UNK-%d", id))
	return err
}

func inferCountryCode(name string) string {
	normalized := strings.ToLower(strings.TrimSpace(name))
	if normalized == "england" {
		return "GB-ENG"
	}
	if len(normalized) < 2 {
		return ""
	}
	return strings.ToUpper(normalized[:2])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
