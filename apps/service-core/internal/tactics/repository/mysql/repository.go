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
	r.ensureOnce.Do(func() {
		if r.db == nil {
			return
		}
		_, r.ensureErr = r.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS team_tactics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  team_id VARCHAR(32) NOT NULL,
  formation VARCHAR(10) NOT NULL,
  pass_ratio DOUBLE NOT NULL,
  shot_ratio DOUBLE NOT NULL,
  pressure DOUBLE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_team_tactics_team_id (team_id)
) ENGINE=InnoDB`)
	})
	return r.ensureErr
}
