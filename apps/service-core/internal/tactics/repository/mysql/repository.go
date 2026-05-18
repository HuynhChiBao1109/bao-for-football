package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
	"time"

	"fifam/apps/service-core/internal/tactics/domain"
)

type Repository struct {
	db         *sql.DB
	ensureOnce sync.Once
	ensureErr  error
	memMu      sync.Mutex
	memStore   map[string]domain.Config
}

type lineupRow struct {
	SlotID       string
	Position     string
	UserPlayerID uint64
}

type realtimeRow struct {
	UserPlayerID     uint64
	PlayerTemplateID uint64
	Pace             int
	Passing          int
	LongPass         int
	Vision           int
	Shooting         int
	Defending        int
	StandingTackle   int
	SlidingTackle    int
	Mental           int
}

var acceptedPositions = map[string]struct{}{
	"GK": {}, "LB": {}, "CB": {}, "RB": {}, "CDM": {}, "CM": {}, "CAM": {}, "LW": {}, "RW": {},
	"LMF": {}, "RMF": {}, "LWB": {}, "RWB": {}, "DMF": {}, "CMF": {}, "AMF": {}, "CF": {},
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db:       db,
		memStore: make(map[string]domain.Config),
	}
}

func (r *Repository) FindByTeamID(ctx context.Context, teamID string) (*domain.Config, error) {
	r.memMu.Lock()
	memo, hasMemo := r.memStore[teamID]
	r.memMu.Unlock()

	if r.db == nil {
		if !hasMemo {
			return nil, nil
		}
		copyCfg := memo
		return &copyCfg, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return nil, err
	}

	var cfg domain.Config
	err := r.db.QueryRowContext(ctx, `
SELECT team_id, formation, pass_ratio, shot_ratio, pressure, updated_at
FROM team_tactics
WHERE team_id = ?
LIMIT 1`, teamID).Scan(
		&cfg.TeamID,
		&cfg.Formation,
		&cfg.PassRatio,
		&cfg.ShotRatio,
		&cfg.Pressure,
		&cfg.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			if !hasMemo {
				return nil, nil
			}
			copyCfg := memo
			return &copyCfg, nil
		}
		return nil, err
	}

	lineup, loadLineupErr := r.loadLineup(ctx, teamID)
	if loadLineupErr != nil {
		return nil, loadLineupErr
	}
	cfg.Lineup = lineup

	if hasMemo {
		cfg.Mode = memo.Mode
		cfg.Gameplay = memo.Gameplay
		cfg.Players = memo.Players
		if len(cfg.Lineup) == 0 {
			cfg.Lineup = memo.Lineup
		}
	}

	return &cfg, nil
}

func (r *Repository) Save(ctx context.Context, cfg domain.Config) (domain.Config, error) {
	cfg.UpdatedAt = time.Now()

	if r.db == nil {
		r.memMu.Lock()
		r.memStore[cfg.TeamID] = cfg
		r.memMu.Unlock()
		return cfg, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Config{}, err
	}

	query := `
INSERT INTO team_tactics (team_id, formation, pass_ratio, shot_ratio, pressure)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
formation = VALUES(formation),
pass_ratio = VALUES(pass_ratio),
shot_ratio = VALUES(shot_ratio),
pressure = VALUES(pressure),
updated_at = CURRENT_TIMESTAMP`

	_, err := r.db.ExecContext(ctx, query,
		cfg.TeamID,
		cfg.Formation,
		cfg.PassRatio,
		cfg.ShotRatio,
		cfg.Pressure,
	)
	if err != nil {
		return domain.Config{}, err
	}

	if err := r.saveLineup(ctx, cfg.TeamID, cfg.Lineup); err != nil {
		return domain.Config{}, err
	}

	r.memMu.Lock()
	r.memStore[cfg.TeamID] = cfg
	r.memMu.Unlock()

	return cfg, nil
}

func (r *Repository) LoadRealtimePlayers(ctx context.Context, teamID string) ([]domain.Player, error) {
	if r.db == nil {
		return nil, nil
	}

	userID, err := parseUserIDFromTeamID(teamID)
	if err != nil {
		return nil, err
	}

	lineup, err := r.loadLineup(ctx, teamID)
	if err != nil {
		return nil, err
	}

	if len(lineup) > 0 {
		players, lineupErr := r.loadPlayersByLineup(ctx, userID, lineup)
		if lineupErr != nil {
			return nil, lineupErr
		}
		if len(players) > 0 {
			return players, nil
		}
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT
  up.id,
  LEAST(99, GREATEST(1, pt.base_pace + up.bonus_pace)) AS pace,
  LEAST(99, GREATEST(1, pt.base_passing + up.bonus_passing)) AS passing,
	LEAST(99, GREATEST(1, pt.base_long_pass + up.bonus_long_pass)) AS long_pass,
	LEAST(99, GREATEST(1, pt.base_vision + up.bonus_vision)) AS vision,
  LEAST(99, GREATEST(1, pt.base_shooting + up.bonus_shooting)) AS shooting,
  LEAST(99, GREATEST(1, pt.base_defending + up.bonus_defending)) AS defending,
	LEAST(99, GREATEST(1, pt.base_standing_tackle + up.bonus_standing_tackle)) AS standing_tackle,
	LEAST(99, GREATEST(1, pt.base_sliding_tackle + up.bonus_sliding_tackle)) AS sliding_tackle,
  LEAST(99, GREATEST(1, ROUND((
    (pt.base_physical + up.bonus_physical) +
    (pt.base_dribbling + up.bonus_dribbling) +
    (pt.base_passing + up.bonus_passing)
  ) / 3, 0))) AS mental
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
WHERE up.user_id = ?
ORDER BY up.id ASC
LIMIT 11`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := make([]domain.Player, 0, 11)
	for rows.Next() {
		var p domain.Player
		if err := rows.Scan(
			&p.CardID,
			&p.Pace,
			&p.Passing,
			&p.LongPass,
			&p.Vision,
			&p.Shooting,
			&p.Defending,
			&p.StandingTackle,
			&p.SlidingTackle,
			&p.Mental,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(players) > 0 {
		return players, nil
	}

	fallbackRows, err := r.db.QueryContext(ctx, `
SELECT
  pt.id,
  LEAST(99, GREATEST(1, pt.base_pace)) AS pace,
  LEAST(99, GREATEST(1, pt.base_passing)) AS passing,
  LEAST(99, GREATEST(1, pt.base_long_pass)) AS long_pass,
  LEAST(99, GREATEST(1, pt.base_vision)) AS vision,
  LEAST(99, GREATEST(1, pt.base_shooting)) AS shooting,
  LEAST(99, GREATEST(1, pt.base_defending)) AS defending,
	LEAST(99, GREATEST(1, pt.base_standing_tackle)) AS standing_tackle,
	LEAST(99, GREATEST(1, pt.base_sliding_tackle)) AS sliding_tackle,
  LEAST(99, GREATEST(1, ROUND((pt.base_physical + pt.base_dribbling + pt.base_passing) / 3, 0))) AS mental
FROM teams t
INNER JOIN player_templates pt ON pt.base_club = t.club_name
WHERE t.user_id = ? AND pt.season = 'normal'
ORDER BY pt.id ASC
LIMIT 11`, userID)
	if err != nil {
		return nil, err
	}
	defer fallbackRows.Close()

	for fallbackRows.Next() {
		var p domain.Player
		if err := fallbackRows.Scan(
			&p.CardID,
			&p.Pace,
			&p.Passing,
			&p.LongPass,
			&p.Vision,
			&p.Shooting,
			&p.Defending,
			&p.StandingTackle,
			&p.SlidingTackle,
			&p.Mental,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}

	if err := fallbackRows.Err(); err != nil {
		return nil, err
	}

	return players, nil
}

func (r *Repository) ensureTable(ctx context.Context) error {
	if r.db == nil {
		return nil
	}

	r.ensureOnce.Do(func() {
		_, err := r.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS team_tactics (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	team_id VARCHAR(32) NOT NULL UNIQUE,
	formation VARCHAR(10) NOT NULL,
	pass_ratio DOUBLE NOT NULL,
	shot_ratio DOUBLE NOT NULL,
	pressure DOUBLE NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		if err != nil {
			r.ensureErr = err
			return
		}

		_, err = r.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS team_lineups (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
	team_id VARCHAR(32) NOT NULL,
	slot_id VARCHAR(32) NOT NULL,
	position VARCHAR(10) NOT NULL,
	user_player_id BIGINT UNSIGNED NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	UNIQUE KEY uk_team_lineups_team_slot (team_id, slot_id),
	KEY idx_team_lineups_team_id (team_id),
	KEY idx_team_lineups_user_player_id (user_player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
		if err != nil {
			r.ensureErr = err
		}
	})

	return r.ensureErr
}

func (r *Repository) loadLineup(ctx context.Context, teamID string) ([]domain.LineupSlot, error) {
	if r.db == nil {
		return nil, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT slot_id, position, user_player_id
FROM team_lineups
WHERE team_id = ?
ORDER BY slot_id ASC`, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.LineupSlot, 0, 11)
	for rows.Next() {
		var item domain.LineupSlot
		if err := rows.Scan(&item.SlotID, &item.Position, &item.UserPlayerID); err != nil {
			return nil, err
		}
		out = append(out, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func (r *Repository) saveLineup(ctx context.Context, teamID string, lineup []domain.LineupSlot) error {
	if r.db == nil {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.ExecContext(ctx, `DELETE FROM team_lineups WHERE team_id = ?`, teamID); err != nil {
		return err
	}

	for _, item := range lineup {
		slotID := strings.ToLower(strings.TrimSpace(item.SlotID))
		position := strings.ToUpper(strings.TrimSpace(item.Position))
		if slotID == "" || position == "" || item.UserPlayerID == 0 {
			continue
		}
		if _, ok := acceptedPositions[position]; !ok {
			continue
		}

		if _, err = tx.ExecContext(ctx, `
INSERT INTO team_lineups (team_id, slot_id, position, user_player_id)
VALUES (?, ?, ?, ?)`, teamID, slotID, position, item.UserPlayerID); err != nil {
			return err
		}
	}

	err = tx.Commit()
	return err
}

func (r *Repository) loadPlayersByLineup(ctx context.Context, userID uint64, lineup []domain.LineupSlot) ([]domain.Player, error) {
	ids := make([]uint64, 0, len(lineup))
	positionByCard := make(map[uint64]string, len(lineup))

	for _, item := range lineup {
		if item.UserPlayerID == 0 {
			continue
		}
		ids = append(ids, item.UserPlayerID)
		positionByCard[item.UserPlayerID] = strings.ToUpper(strings.TrimSpace(item.Position))
	}

	if len(ids) == 0 {
		return nil, nil
	}

	plh := placeholders(len(ids))
	query := fmt.Sprintf(`
SELECT
	up.id,
	up.player_template_id,
	LEAST(99, GREATEST(1, pt.base_pace + up.bonus_pace)) AS pace,
	LEAST(99, GREATEST(1, pt.base_passing + up.bonus_passing)) AS passing,
	LEAST(99, GREATEST(1, pt.base_long_pass + up.bonus_long_pass)) AS long_pass,
	LEAST(99, GREATEST(1, pt.base_vision + up.bonus_vision)) AS vision,
	LEAST(99, GREATEST(1, pt.base_shooting + up.bonus_shooting)) AS shooting,
	LEAST(99, GREATEST(1, pt.base_defending + up.bonus_defending)) AS defending,
	LEAST(99, GREATEST(1, pt.base_standing_tackle + up.bonus_standing_tackle)) AS standing_tackle,
	LEAST(99, GREATEST(1, pt.base_sliding_tackle + up.bonus_sliding_tackle)) AS sliding_tackle,
	LEAST(99, GREATEST(1, ROUND(((pt.base_physical + up.bonus_physical) + (pt.base_dribbling + up.bonus_dribbling) + (pt.base_passing + up.bonus_passing)) / 3, 0))) AS mental
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
WHERE up.user_id = ? AND up.id IN (%s)`, plh)

	args := make([]any, 0, len(ids)+1)
	args = append(args, userID)
	for _, id := range ids {
		args = append(args, id)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byCard := make(map[uint64]realtimeRow, len(ids))
	templateIDs := make([]uint64, 0, len(ids))
	seenTemplate := make(map[uint64]struct{})

	for rows.Next() {
		var item realtimeRow
		if err := rows.Scan(
			&item.UserPlayerID,
			&item.PlayerTemplateID,
			&item.Pace,
			&item.Passing,
			&item.LongPass,
			&item.Vision,
			&item.Shooting,
			&item.Defending,
			&item.StandingTackle,
			&item.SlidingTackle,
			&item.Mental,
		); err != nil {
			return nil, err
		}
		byCard[item.UserPlayerID] = item
		if _, ok := seenTemplate[item.PlayerTemplateID]; !ok {
			seenTemplate[item.PlayerTemplateID] = struct{}{}
			templateIDs = append(templateIDs, item.PlayerTemplateID)
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	effectsByTemplate, err := r.loadPositionEffects(ctx, templateIDs)
	if err != nil {
		return nil, err
	}

	out := make([]domain.Player, 0, len(ids))
	for _, item := range lineup {
		if item.UserPlayerID == 0 {
			continue
		}
		raw, ok := byCard[item.UserPlayerID]
		if !ok {
			continue
		}

		targetPosition := normalizePosition(positionByCard[item.UserPlayerID])
		effect := 0.5
		if positionMap, ok := effectsByTemplate[raw.PlayerTemplateID]; ok {
			if value, exists := positionMap[targetPosition]; exists {
				effect = value
			}
		}

		out = append(out, domain.Player{
			CardID:         raw.UserPlayerID,
			Pace:           scaleStat(raw.Pace, effect),
			Passing:        scaleStat(raw.Passing, effect),
			LongPass:       scaleStat(raw.LongPass, effect),
			Vision:         scaleStat(raw.Vision, effect),
			Shooting:       scaleStat(raw.Shooting, effect),
			Defending:      scaleStat(raw.Defending, effect),
			StandingTackle: scaleStat(raw.StandingTackle, effect),
			SlidingTackle:  scaleStat(raw.SlidingTackle, effect),
			Mental:         scaleStat(raw.Mental, effect),
		})
	}

	if len(out) >= 11 {
		return out[:11], nil
	}

	legacy, err := r.loadLegacyPlayers(ctx, userID)
	if err != nil {
		return nil, err
	}

	selected := make(map[uint64]struct{}, len(out))
	for _, item := range out {
		selected[item.CardID] = struct{}{}
	}

	for _, item := range legacy {
		if _, ok := selected[item.CardID]; ok {
			continue
		}
		out = append(out, item)
		if len(out) >= 11 {
			break
		}
	}

	return out, nil
}

func (r *Repository) loadLegacyPlayers(ctx context.Context, userID uint64) ([]domain.Player, error) {
	rows, err := r.db.QueryContext(ctx, `
SELECT
  up.id,
  LEAST(99, GREATEST(1, pt.base_pace + up.bonus_pace)) AS pace,
  LEAST(99, GREATEST(1, pt.base_passing + up.bonus_passing)) AS passing,
	LEAST(99, GREATEST(1, pt.base_long_pass + up.bonus_long_pass)) AS long_pass,
	LEAST(99, GREATEST(1, pt.base_vision + up.bonus_vision)) AS vision,
  LEAST(99, GREATEST(1, pt.base_shooting + up.bonus_shooting)) AS shooting,
  LEAST(99, GREATEST(1, pt.base_defending + up.bonus_defending)) AS defending,
	LEAST(99, GREATEST(1, pt.base_standing_tackle + up.bonus_standing_tackle)) AS standing_tackle,
	LEAST(99, GREATEST(1, pt.base_sliding_tackle + up.bonus_sliding_tackle)) AS sliding_tackle,
  LEAST(99, GREATEST(1, ROUND(((pt.base_physical + up.bonus_physical) + (pt.base_dribbling + up.bonus_dribbling) + (pt.base_passing + up.bonus_passing)) / 3, 0))) AS mental
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
WHERE up.user_id = ?
ORDER BY up.id ASC
LIMIT 11`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := make([]domain.Player, 0, 11)
	for rows.Next() {
		var p domain.Player
		if err := rows.Scan(
			&p.CardID,
			&p.Pace,
			&p.Passing,
			&p.LongPass,
			&p.Vision,
			&p.Shooting,
			&p.Defending,
			&p.StandingTackle,
			&p.SlidingTackle,
			&p.Mental,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(players) > 0 {
		return players, nil
	}

	fallbackRows, err := r.db.QueryContext(ctx, `
SELECT
  pt.id,
  LEAST(99, GREATEST(1, pt.base_pace)) AS pace,
  LEAST(99, GREATEST(1, pt.base_passing)) AS passing,
  LEAST(99, GREATEST(1, pt.base_long_pass)) AS long_pass,
  LEAST(99, GREATEST(1, pt.base_vision)) AS vision,
  LEAST(99, GREATEST(1, pt.base_shooting)) AS shooting,
  LEAST(99, GREATEST(1, pt.base_defending)) AS defending,
	LEAST(99, GREATEST(1, pt.base_standing_tackle)) AS standing_tackle,
	LEAST(99, GREATEST(1, pt.base_sliding_tackle)) AS sliding_tackle,
  LEAST(99, GREATEST(1, ROUND((pt.base_physical + pt.base_dribbling + pt.base_passing) / 3, 0))) AS mental
FROM teams t
INNER JOIN player_templates pt ON pt.base_club = t.club_name
WHERE t.user_id = ? AND pt.season = 'normal'
ORDER BY pt.id ASC
LIMIT 11`, userID)
	if err != nil {
		return nil, err
	}
	defer fallbackRows.Close()

	for fallbackRows.Next() {
		var p domain.Player
		if err := fallbackRows.Scan(
			&p.CardID,
			&p.Pace,
			&p.Passing,
			&p.LongPass,
			&p.Vision,
			&p.Shooting,
			&p.Defending,
			&p.StandingTackle,
			&p.SlidingTackle,
			&p.Mental,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}

	if err := fallbackRows.Err(); err != nil {
		return nil, err
	}

	return players, nil
}

func (r *Repository) loadPositionEffects(ctx context.Context, templateIDs []uint64) (map[uint64]map[string]float64, error) {
	result := make(map[uint64]map[string]float64)
	if len(templateIDs) == 0 {
		return result, nil
	}

	query := fmt.Sprintf(`
SELECT player_template_id, position, effect
FROM position_players
WHERE player_template_id IN (%s)`, placeholders(len(templateIDs)))

	args := make([]any, 0, len(templateIDs))
	for _, id := range templateIDs {
		args = append(args, id)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "doesn't exist") {
			return result, nil
		}
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var templateID uint64
		var position string
		var effect float64
		if err := rows.Scan(&templateID, &position, &effect); err != nil {
			return nil, err
		}

		normalized := normalizePosition(position)
		if _, ok := result[templateID]; !ok {
			result[templateID] = make(map[string]float64)
		}
		result[templateID][normalized] = clampEffect(effect)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	parts := make([]string, n)
	for i := 0; i < n; i += 1 {
		parts[i] = "?"
	}
	return strings.Join(parts, ",")
}

func normalizePosition(position string) string {
	value := strings.ToUpper(strings.TrimSpace(position))
	switch value {
	case "LCB", "RCB":
		return "CB"
	case "LM":
		return "LMF"
	case "RM":
		return "RMF"
	case "LCM", "RCM", "CM":
		return "CM"
	case "ST", "ST2":
		return "CF"
	default:
		return value
	}
}

func clampEffect(effect float64) float64 {
	if effect <= 0 {
		return 0.5
	}
	if effect > 1 {
		return 1
	}
	return effect
}

func scaleStat(value int, effect float64) int {
	scaled := int(math.Round(float64(value) * clampEffect(effect)))
	if scaled < 1 {
		return 1
	}
	if scaled > 99 {
		return 99
	}
	return scaled
}

func parseUserIDFromTeamID(teamID string) (uint64, error) {
	normalized := strings.ToLower(strings.TrimSpace(teamID))
	parts := strings.Split(normalized, "-")
	if len(parts) != 2 || parts[0] != "user" {
		return 0, fmt.Errorf("teamId %q cannot map to user", teamID)
	}

	userID, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil || userID == 0 {
		return 0, fmt.Errorf("teamId %q has invalid user id", teamID)
	}

	return userID, nil
}
