package mysql

import (
	"context"
	"database/sql"
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
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()

		cfg, ok := r.memStore[teamID]
		if !ok {
			return nil, nil
		}
		copyCfg := cfg
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
			return nil, nil
		}
		return nil, err
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

	return cfg, nil
}

func (r *Repository) ensureTable(ctx context.Context) error {
	return nil
}
