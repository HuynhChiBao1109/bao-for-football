package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"fifam/apps/service-core/internal/auth/domain"

	"golang.org/x/crypto/bcrypt"
)

type Repository struct {
	db         *sql.DB
	ensureOnce sync.Once
	ensureErr  error
	memMu      sync.Mutex
	memData    map[string]domain.User
	memTeams   map[uint64]domain.ClubOption
	nextID     uint64
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db:       db,
		memData:  make(map[string]domain.User),
		memTeams: make(map[uint64]domain.ClubOption),
		nextID:   1,
	}
}

func (r *Repository) EnsureUserTable(ctx context.Context) error {
	return nil
}

func (r *Repository) ListRegistrationClubs(ctx context.Context) ([]domain.ClubOption, error) {
	if r.db == nil {
		return defaultClubs(), nil
	}

	if err := r.EnsureUserTable(ctx); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT c.id, c.name, c.logo, c.country_id, c.budget, c.league_name
FROM clubs c
ORDER BY c.id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	clubs := make([]domain.ClubOption, 0, 4)
	for rows.Next() {
		var club domain.ClubOption
		if err := rows.Scan(
			&club.ID,
			&club.Name,
			&club.Logo,
			&club.CountryID,
			&club.Budget,
			&club.LeagueName,
		); err != nil {
			return nil, err
		}
		clubs = append(clubs, club)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(clubs) == 0 {
		return defaultClubs(), nil
	}

	return clubs, nil
}

func (r *Repository) FindByUsername(ctx context.Context, username string) (*domain.User, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		user, ok := r.memData[username]
		if !ok {
			return nil, nil
		}
		copyUser := user
		return &copyUser, nil
	}

	if err := r.EnsureUserTable(ctx); err != nil {
		return nil, err
	}

	var user domain.User
	var createdAt sql.NullTime
	err := r.db.QueryRowContext(ctx, `
SELECT id, username, password_hash, created_at
FROM users
WHERE username = ?
LIMIT 1`, username).Scan(
		&user.ID,
		&user.Username,
		&user.PasswordHash,
		&createdAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if createdAt.Valid {
		user.CreatedAt = createdAt.Time
	}

	return &user, nil
}

func (r *Repository) GetTeamAssignment(ctx context.Context, userID uint64) (*domain.TeamAssignment, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()

		club, ok := r.memTeams[userID]
		if !ok {
			return nil, nil
		}

		clubID := club.ID
		return &domain.TeamAssignment{
			UserID:    userID,
			ClubID:    &clubID,
			ClubName:  club.Name,
			Budget:    club.Budget,
			RankPoint: 0,
		}, nil
	}

	if err := r.EnsureUserTable(ctx); err != nil {
		return nil, err
	}

	var team domain.TeamAssignment
	var clubID sql.NullInt64
	err := r.db.QueryRowContext(ctx, `
SELECT user_id, club_id, club_name, budget, rank_point
FROM teams
WHERE user_id = ?
LIMIT 1`, userID).Scan(
		&team.UserID,
		&clubID,
		&team.ClubName,
		&team.Budget,
		&team.RankPoint,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if clubID.Valid {
		value := clubID.Int64
		team.ClubID = &value
	}

	return &team, nil
}

func (r *Repository) Create(ctx context.Context, username, password string) (domain.User, error) {
	if err := r.EnsureUserTable(ctx); err != nil {
		return domain.User{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return domain.User{}, err
	}

	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		if _, exists := r.memData[username]; exists {
			return domain.User{}, errors.New("username already exists")
		}
		user := domain.User{ID: r.nextID, Username: username, PasswordHash: string(hash), CreatedAt: time.Now()}
		r.nextID++
		r.memData[username] = user
		return user, nil
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO users (username, password_hash)
VALUES (?, ?)`, username, string(hash))
	if err != nil {
		return domain.User{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.User{}, err
	}

	return domain.User{ID: uint64(id), Username: username, PasswordHash: string(hash), CreatedAt: time.Now()}, nil
}

func (r *Repository) EnsureAdmin(ctx context.Context, username, password string) error {
	user, err := r.FindByUsername(ctx, username)
	if err != nil {
		return err
	}
	if user != nil {
		return nil
	}

	_, err = r.Create(ctx, username, password)
	return err
}

func (r *Repository) AssignClubToUser(ctx context.Context, userID uint64, clubID int64, clubName string) error {
	clubName = strings.TrimSpace(clubName)
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		for _, club := range defaultClubs() {
			if club.ID == clubID {
				if clubName != "" {
					club.Name = clubName
				}
				r.memTeams[userID] = club
				return nil
			}
		}
		return fmt.Errorf("club id %d not found", clubID)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var starterClubName string
	var budget int64
	err = tx.QueryRowContext(ctx, `
SELECT name, budget
FROM clubs
WHERE id = ?
LIMIT 1`, clubID).Scan(&starterClubName, &budget)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("club id %d not found", clubID)
		}
		return err
	}
	if clubName == "" {
		clubName = starterClubName
	}

	_, err = tx.ExecContext(ctx, `
INSERT INTO teams (user_id, club_id, club_name, budget, rank_point)
VALUES (?, ?, ?, ?, 0)
ON DUPLICATE KEY UPDATE
  club_id = VALUES(club_id),
  club_name = VALUES(club_name),
  budget = VALUES(budget)`,
		userID,
		clubID,
		clubName,
		budget,
	)
	if err != nil {
		return err
	}

	if err := r.ensureStarterPlayers(ctx, tx, userID, starterClubName); err != nil {
		return err
	}

	return tx.Commit()
}

func (r *Repository) ensureStarterPlayers(ctx context.Context, tx *sql.Tx, userID uint64, starterClubName string) error {
	var ownedCount int
	err := tx.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM user_players
WHERE user_id = ?`, userID).Scan(&ownedCount)
	if err != nil {
		return err
	}
	if ownedCount >= 22 {
		return nil
	}

	if err := syncPlayerTemplatesFromAdmin(ctx, tx, starterClubName); err != nil {
		return err
	}

	var availableCount int
	err = tx.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM player_templates
WHERE base_club = ? AND season = 'Normal'`, starterClubName).Scan(&availableCount)
	if err != nil {
		return err
	}
	if availableCount < 22 {
		return fmt.Errorf("starter club %q does not have enough normal player templates", starterClubName)
	}

	slotsLeft := 50 - ownedCount
	if slotsLeft <= 0 {
		return errors.New("user cannot own more than 50 player cards")
	}

	assignCount := 22 - ownedCount
	if assignCount > slotsLeft {
		assignCount = slotsLeft
	}

	result, err := tx.ExecContext(ctx, `
INSERT INTO user_players (
  user_id,
  player_template_id,
  level,
  exp,
  current_points,
  bonus_shooting,
  bonus_passing,
	bonus_long_pass,
	bonus_vision,
	bonus_gk_reach,
	bonus_counter_attack_awareness,
	bonus_gk_parrying,
	bonus_gk_reflex,
	bonus_gk_catching,
	bonus_duels,
  bonus_pace,
  bonus_physical,
  bonus_defending,
	bonus_standing_tackle,
	bonus_sliding_tackle,
  bonus_dribbling,
  obtained_at
)
SELECT ?, pt.id, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP
FROM player_templates pt
LEFT JOIN user_players up
  ON up.user_id = ? AND up.player_template_id = pt.id
WHERE pt.base_club = ?
  AND pt.season = 'Normal'
  AND up.id IS NULL
ORDER BY pt.id ASC
LIMIT ?`, userID, userID, starterClubName, assignCount)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if int(rowsAffected) != assignCount {
		return fmt.Errorf("expected to assign %d starter players, assigned %d", assignCount, rowsAffected)
	}

	return nil
}

func syncPlayerTemplatesFromAdmin(ctx context.Context, tx *sql.Tx, starterClubName string) error {
	_, err := tx.ExecContext(ctx, `
INSERT INTO player_templates (
  name,
  height_cm,
	country_id,
  nationality,
  base_club,
  season,
  image_url,
  base_shooting,
  base_passing,
	base_long_pass,
	base_vision,
	base_gk_reach,
	base_counter_attack_awareness,
	base_gk_parrying,
	base_gk_reflex,
	base_gk_catching,
	base_duels,
  base_pace,
  base_physical,
  base_defending,
	base_standing_tackle,
	base_sliding_tackle,
  base_dribbling
)
SELECT
  ap.name,
  170,
	ap.country_id,
  ap.nationality,
  ap.base_club,
  ap.season,
  '',
  ap.shooting,
  ap.passing,
	ap.long_pass,
	ap.vision,
	ap.gk_reach,
	ap.counter_attack_awareness,
	ap.gk_parrying,
	ap.gk_reflex,
	ap.gk_catching,
	ap.duels,
  ap.pace,
  ap.physical,
  ap.defending,
	ap.standing_tackle,
	ap.sliding_tackle,
  ap.dribbling
FROM admin_players ap
LEFT JOIN player_templates pt
  ON pt.name = ap.name
 AND pt.base_club = ap.base_club
 AND pt.season = ap.season
WHERE ap.source_type = 'normal'
  AND ap.base_club = ?
  AND pt.id IS NULL
ORDER BY ap.id ASC`, starterClubName)
	return err
}

func defaultClubs() []domain.ClubOption {
	return []domain.ClubOption{
		{ID: 1, Name: "Manchester United", Logo: "https://media.api-sports.io/football/teams/33.png", Budget: 120000000, LeagueName: "Premier League"},
		{ID: 2, Name: "Manchester City", Logo: "https://media.api-sports.io/football/teams/50.png", Budget: 118000000, LeagueName: "Premier League"},
		{ID: 3, Name: "Liverpool", Logo: "https://media.api-sports.io/football/teams/40.png", Budget: 116000000, LeagueName: "Premier League"},
		{ID: 4, Name: "Chelsea", Logo: "https://media.api-sports.io/football/teams/49.png", Budget: 114000000, LeagueName: "Premier League"},
		{ID: 5, Name: "Arsenal", Logo: "https://media.api-sports.io/football/teams/42.png", Budget: 112000000, LeagueName: "Premier League"},
		{ID: 6, Name: "Tottenham Hotspur", Logo: "https://media.api-sports.io/football/teams/47.png", Budget: 110000000, LeagueName: "Premier League"},
		{ID: 7, Name: "Newcastle United", Logo: "https://media.api-sports.io/football/teams/34.png", Budget: 108000000, LeagueName: "Premier League"},
		{ID: 8, Name: "Aston Villa", Logo: "https://media.api-sports.io/football/teams/66.png", Budget: 106000000, LeagueName: "Premier League"},
	}
}
