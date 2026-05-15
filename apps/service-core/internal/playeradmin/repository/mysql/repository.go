package mysql

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"fifam/apps/service-core/internal/playeradmin/domain"
)

type Repository struct {
	db         *sql.DB
	ensureOnce sync.Once
	ensureErr  error
	memMu      sync.Mutex
	memData    []domain.Player
	nextID     int64
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db, nextID: 1}
}

func (r *Repository) List(ctx context.Context) ([]domain.Player, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		out := make([]domain.Player, len(r.memData))
		copy(out, r.memData)
		return out, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return nil, err
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, nationality, base_club, season, source_type, special_skill,
       shooting, passing, pace, physical, defending, dribbling, created_at
FROM admin_players
ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := make([]domain.Player, 0, 32)
	for rows.Next() {
		var p domain.Player
		if err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.Nationality,
			&p.BaseClub,
			&p.Season,
			&p.SourceType,
			&p.SpecialSkill,
			&p.Shooting,
			&p.Passing,
			&p.Pace,
			&p.Physical,
			&p.Defending,
			&p.Dribbling,
			&p.CreatedAt,
		); err != nil {
			return nil, err
		}
		players = append(players, p)
	}

	return players, rows.Err()
}

func (r *Repository) Create(ctx context.Context, input domain.Player) (domain.Player, error) {
	input.CreatedAt = time.Now()

	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		input.ID = r.nextID
		r.nextID++
		r.memData = append([]domain.Player{input}, r.memData...)
		return input, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Player{}, err
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO admin_players (
  name, nationality, base_club, season, source_type, special_skill,
  shooting, passing, pace, physical, defending, dribbling
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Name,
		input.Nationality,
		input.BaseClub,
		input.Season,
		input.SourceType,
		input.SpecialSkill,
		input.Shooting,
		input.Passing,
		input.Pace,
		input.Physical,
		input.Defending,
		input.Dribbling,
	)
	if err != nil {
		return domain.Player{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.Player{}, err
	}
	input.ID = id

	return input, nil
}

func (r *Repository) ensureTable(ctx context.Context) error {
	return nil
}
