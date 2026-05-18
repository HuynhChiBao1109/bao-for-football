package mysql

import (
	"context"
	"database/sql"
	"errors"

	"fifam/apps/service-core/internal/club/domain"
)

const defaultClubBudget int64 = 360000000

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
			Name:       "Manchester United",
			Logo:       "https://media.api-sports.io/football/teams/33.png",
			CountryID:  nil,
			LeagueID:   nil,
			Budget:     defaultClubBudget,
			LeagueName: "Premier League",
		}, nil
	}

	club := &domain.Club{}
	var countryID sql.NullInt64
	var leagueID sql.NullInt64
	query := `
	SELECT c.id, c.name, c.logo, c.country_id, c.league_id, COALESCE(l.name, '')
FROM clubs
LEFT JOIN leagues l ON l.id = clubs.league_id
WHERE id = ?
LIMIT 1`

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&club.ID,
		&club.Name,
		&club.Logo,
		&countryID,
		&leagueID,
		&club.LeagueName,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if countryID.Valid {
		value := countryID.Int64
		club.CountryID = &value
	}
	if leagueID.Valid {
		value := leagueID.Int64
		club.LeagueID = &value
	}
	club.Budget = defaultClubBudget

	return club, nil
}
