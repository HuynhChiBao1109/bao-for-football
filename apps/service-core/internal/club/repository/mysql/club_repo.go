package mysql

import (
	"context"
	"database/sql"
	"errors"

	"fifam/apps/service-core/internal/club/domain"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetByID(ctx context.Context, id int64) (*domain.Club, error) {
	if r.db == nil {
		return &domain.Club{
			ID:         id,
			Name:       "FC Navy",
			Formation:  "4-3-3",
			Budget:     120000000,
			LeagueName: "Premier League",
		}, nil
	}

	club := &domain.Club{}
	query := `
SELECT id, name, formation, budget, league_name
FROM clubs
WHERE id = ?
LIMIT 1`

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&club.ID,
		&club.Name,
		&club.Formation,
		&club.Budget,
		&club.LeagueName,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return club, nil
}
