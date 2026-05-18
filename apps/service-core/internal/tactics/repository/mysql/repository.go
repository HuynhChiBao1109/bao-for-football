package mysql

import (
	"context"
	"database/sql"
	"fmt"
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

	if hasMemo {
		cfg.Mode = memo.Mode
		cfg.Gameplay = memo.Gameplay
		cfg.Players = memo.Players
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
	return nil
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
