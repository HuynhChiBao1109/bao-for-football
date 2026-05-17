package mysql

import (
	"context"
	"database/sql"
	"errors"
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
SELECT ap.id, ap.name, ap.country_id,
	COALESCE(c.id, 0) AS country_row_id,
	COALESCE(c.name, ''),
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	COALESCE(c.name, ap.nationality) AS nationality,
	ap.base_club, ap.season, ap.source_type, ap.special_skill,
	ap.shooting, ap.passing, ap.long_pass, ap.vision, ap.gk_reach, ap.counter_attack_awareness, ap.gk_parrying, ap.gk_reflex, ap.gk_catching, ap.duels, ap.pace, ap.physical, ap.defending, ap.standing_tackle, ap.sliding_tackle, ap.dribbling, ap.created_at
FROM admin_players ap
LEFT JOIN countries c ON c.id = ap.country_id
ORDER BY ap.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	players := make([]domain.Player, 0, 32)
	for rows.Next() {
		var p domain.Player
		var countryRowID int64
		var createdAt sql.NullTime
		if err := rows.Scan(
			&p.ID,
			&p.Name,
			&p.CountryID,
			&countryRowID,
			&p.Country.Name,
			&p.Country.Code,
			&p.Country.Flag,
			&p.Nationality,
			&p.BaseClub,
			&p.Season,
			&p.SourceType,
			&p.SpecialSkill,
			&p.Shooting,
			&p.Passing,
			&p.LongPass,
			&p.Vision,
			&p.GKReach,
			&p.CtrAwareness,
			&p.GKParrying,
			&p.GKReflex,
			&p.GKCatching,
			&p.Duels,
			&p.Pace,
			&p.Physical,
			&p.Defending,
			&p.StandingTackle,
			&p.SlidingTackle,
			&p.Dribbling,
			&createdAt,
		); err != nil {
			return nil, err
		}
		if createdAt.Valid {
			p.CreatedAt = createdAt.Time
		}
		if countryRowID > 0 {
			p.Country.ID = countryRowID
		}
		players = append(players, p)
	}

	return players, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id int64) (domain.Player, error) {
	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		for _, item := range r.memData {
			if item.ID == id {
				return item, nil
			}
		}
		return domain.Player{}, errors.New("player not found")
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Player{}, err
	}

	row := r.db.QueryRowContext(ctx, `
SELECT ap.id, ap.name, ap.country_id,
	COALESCE(c.id, 0) AS country_row_id,
	COALESCE(c.name, ''),
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	COALESCE(c.name, ap.nationality) AS nationality,
	ap.base_club, ap.season, ap.source_type, ap.special_skill,
	ap.shooting, ap.passing, ap.long_pass, ap.vision, ap.gk_reach, ap.counter_attack_awareness, ap.gk_parrying, ap.gk_reflex, ap.gk_catching, ap.duels, ap.pace, ap.physical, ap.defending, ap.standing_tackle, ap.sliding_tackle, ap.dribbling, ap.created_at
FROM admin_players ap
LEFT JOIN countries c ON c.id = ap.country_id
WHERE ap.id = ?
LIMIT 1`, id)

	var p domain.Player
	var countryRowID int64
	var createdAt sql.NullTime
	if err := row.Scan(
		&p.ID,
		&p.Name,
		&p.CountryID,
		&countryRowID,
		&p.Country.Name,
		&p.Country.Code,
		&p.Country.Flag,
		&p.Nationality,
		&p.BaseClub,
		&p.Season,
		&p.SourceType,
		&p.SpecialSkill,
		&p.Shooting,
		&p.Passing,
		&p.LongPass,
		&p.Vision,
		&p.GKReach,
		&p.CtrAwareness,
		&p.GKParrying,
		&p.GKReflex,
		&p.GKCatching,
		&p.Duels,
		&p.Pace,
		&p.Physical,
		&p.Defending,
		&p.StandingTackle,
		&p.SlidingTackle,
		&p.Dribbling,
		&createdAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Player{}, errors.New("player not found")
		}
		return domain.Player{}, err
	}
	if createdAt.Valid {
		p.CreatedAt = createdAt.Time
	}

	if countryRowID > 0 {
		p.Country.ID = countryRowID
	}

	return p, nil
}

func (r *Repository) ListCountries(ctx context.Context) ([]domain.Country, error) {
	if r.db == nil {
		return []domain.Country{}, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT id, name, COALESCE(code, ''), COALESCE(flag, '')
FROM countries
ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.Country, 0, 64)
	for rows.Next() {
		var item domain.Country
		if err := rows.Scan(&item.ID, &item.Name, &item.Code, &item.Flag); err != nil {
			return nil, err
		}
		out = append(out, item)
	}

	return out, rows.Err()
}

func (r *Repository) Create(ctx context.Context, input domain.Player) (domain.Player, error) {
	input.CreatedAt = time.Now()

	if r.db == nil {
		r.memMu.Lock()
		defer r.memMu.Unlock()
		input.ID = r.nextID
		r.nextID++
		input.Nationality = input.Country.Name
		r.memData = append([]domain.Player{input}, r.memData...)
		return input, nil
	}

	if err := r.ensureTable(ctx); err != nil {
		return domain.Player{}, err
	}

	if input.CountryID > 0 {
		countryRow := r.db.QueryRowContext(ctx, `
SELECT id, name, COALESCE(code, ''), COALESCE(flag, '')
FROM countries
WHERE id = ?
LIMIT 1`, input.CountryID)
		if err := countryRow.Scan(&input.Country.ID, &input.Country.Name, &input.Country.Code, &input.Country.Flag); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return domain.Player{}, errors.New("country not found")
			}
			return domain.Player{}, err
		}
		input.Nationality = input.Country.Name
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO admin_players (
  name, country_id, nationality, base_club, season, source_type, special_skill,
	shooting, passing, long_pass, vision, gk_reach, counter_attack_awareness, gk_parrying, gk_reflex, gk_catching, duels, pace, physical, defending, standing_tackle, sliding_tackle, dribbling
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Name,
		input.CountryID,
		input.Nationality,
		input.BaseClub,
		input.Season,
		input.SourceType,
		input.SpecialSkill,
		input.Shooting,
		input.Passing,
		input.LongPass,
		input.Vision,
		input.GKReach,
		input.CtrAwareness,
		input.GKParrying,
		input.GKReflex,
		input.GKCatching,
		input.Duels,
		input.Pace,
		input.Physical,
		input.Defending,
		input.StandingTackle,
		input.SlidingTackle,
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
