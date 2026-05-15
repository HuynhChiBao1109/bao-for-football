package mysql

import (
	"context"
	"database/sql"
	"errors"

	"fifam/apps/service-core/internal/player/domain"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

type rawCard struct {
	UserPlayerID     uint64
	PlayerTemplateID uint64
	Name             string
	HeightCM         uint16
	BaseClub         string
	Season           string
	Level            uint8
	Exp              uint32
	CurrentPoints    uint32
	CountryID        int64
	CountryName      string
	CountryCode      string
	CountryFlag      string
	BaseShooting     int
	BasePassing      int
	BasePace         int
	BasePhysical     int
	BaseDefending    int
	BaseDribbling    int
	BonusShooting    int
	BonusPassing     int
	BonusPace        int
	BonusPhysical    int
	BonusDefending   int
	BonusDribbling   int
}

func (r *Repository) ListByUserID(ctx context.Context, userID uint64) ([]domain.PlayerCard, error) {
	if r.db == nil {
		return []domain.PlayerCard{}, nil
	}

	rows, err := r.db.QueryContext(ctx, `
SELECT
	up.id,
	up.player_template_id,
	pt.name,
	pt.height_cm,
	pt.base_club,
	pt.season,
	up.level,
	up.exp,
	up.current_points,
	COALESCE(c.id, 0) AS country_id,
	COALESCE(c.name, pt.nationality) AS country_name,
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	pt.base_shooting,
	pt.base_passing,
	pt.base_pace,
	pt.base_physical,
	pt.base_defending,
	pt.base_dribbling,
	up.bonus_shooting,
	up.bonus_passing,
	up.bonus_pace,
	up.bonus_physical,
	up.bonus_defending,
	up.bonus_dribbling
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
LEFT JOIN countries c ON c.id = pt.country_id
WHERE up.user_id = ?
ORDER BY up.level DESC, up.id ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]domain.PlayerCard, 0, 32)
	for rows.Next() {
		item, err := scanRawCard(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, toPlayerCard(item))
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return out, nil
}

func (r *Repository) FindByUserPlayerID(ctx context.Context, userID uint64, userPlayerID uint64) (domain.PlayerCard, error) {
	if r.db == nil {
		return domain.PlayerCard{}, errors.New("database is not configured")
	}

	row := r.db.QueryRowContext(ctx, `
SELECT
	up.id,
	up.player_template_id,
	pt.name,
	pt.height_cm,
	pt.base_club,
	pt.season,
	up.level,
	up.exp,
	up.current_points,
	COALESCE(c.id, 0) AS country_id,
	COALESCE(c.name, pt.nationality) AS country_name,
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	pt.base_shooting,
	pt.base_passing,
	pt.base_pace,
	pt.base_physical,
	pt.base_defending,
	pt.base_dribbling,
	up.bonus_shooting,
	up.bonus_passing,
	up.bonus_pace,
	up.bonus_physical,
	up.bonus_defending,
	up.bonus_dribbling
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
LEFT JOIN countries c ON c.id = pt.country_id
WHERE up.user_id = ? AND up.id = ?
LIMIT 1`, userID, userPlayerID)

	item, err := scanRawCard(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.PlayerCard{}, errors.New("player card not found")
		}
		return domain.PlayerCard{}, err
	}

	return toPlayerCard(item), nil
}

func (r *Repository) LevelUp(ctx context.Context, userID uint64, userPlayerID uint64, requiredExp uint32, grantPoints uint32) error {
	if r.db == nil {
		return errors.New("database is not configured")
	}

	result, err := r.db.ExecContext(ctx, `
UPDATE user_players
SET level = level + 1,
	exp = exp - ?,
	current_points = current_points + ?
WHERE id = ?
	AND user_id = ?
	AND level < 36
	AND exp >= ?`, requiredExp, grantPoints, userPlayerID, userID, requiredExp)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("cannot level up player")
	}

	return nil
}

func (r *Repository) AllocateStats(ctx context.Context, userID uint64, userPlayerID uint64, input domain.AllocateStatsInput, deltaPoints int32) error {
	if r.db == nil {
		return errors.New("database is not configured")
	}

query := `
UPDATE user_players
SET bonus_shooting = bonus_shooting + ?,
	bonus_passing = bonus_passing + ?,
	bonus_pace = bonus_pace + ?,
	bonus_physical = bonus_physical + ?,
	bonus_defending = bonus_defending + ?,
	bonus_dribbling = bonus_dribbling + ?,
	current_points = current_points - ?
WHERE id = ?
	AND user_id = ?
	AND bonus_shooting + ? >= 0
	AND bonus_passing + ? >= 0
	AND bonus_pace + ? >= 0
	AND bonus_physical + ? >= 0
	AND bonus_defending + ? >= 0
	AND bonus_dribbling + ? >= 0`

	args := []any{
		input.Shooting,
		input.Passing,
		input.Pace,
		input.Physical,
		input.Defending,
		input.Dribbling,
		deltaPoints,
		userPlayerID,
		userID,
		input.Shooting,
		input.Passing,
		input.Pace,
		input.Physical,
		input.Defending,
		input.Dribbling,
	}

	if deltaPoints > 0 {
		query += "\n\tAND current_points >= ?"
		args = append(args, deltaPoints)
	}

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("cannot allocate stats")
	}

	return nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRawCard(s scanner) (rawCard, error) {
	var item rawCard
	err := s.Scan(
		&item.UserPlayerID,
		&item.PlayerTemplateID,
		&item.Name,
		&item.HeightCM,
		&item.BaseClub,
		&item.Season,
		&item.Level,
		&item.Exp,
		&item.CurrentPoints,
		&item.CountryID,
		&item.CountryName,
		&item.CountryCode,
		&item.CountryFlag,
		&item.BaseShooting,
		&item.BasePassing,
		&item.BasePace,
		&item.BasePhysical,
		&item.BaseDefending,
		&item.BaseDribbling,
		&item.BonusShooting,
		&item.BonusPassing,
		&item.BonusPace,
		&item.BonusPhysical,
		&item.BonusDefending,
		&item.BonusDribbling,
	)
	if err != nil {
		return rawCard{}, err
	}
	return item, nil
}

func toPlayerCard(item rawCard) domain.PlayerCard {
	base := domain.CardStats{
		Shooting:  item.BaseShooting,
		Passing:   item.BasePassing,
		Pace:      item.BasePace,
		Physical:  item.BasePhysical,
		Defending: item.BaseDefending,
		Dribbling: item.BaseDribbling,
	}

	bonus := domain.CardStats{
		Shooting:  item.BonusShooting,
		Passing:   item.BonusPassing,
		Pace:      item.BonusPace,
		Physical:  item.BonusPhysical,
		Defending: item.BonusDefending,
		Dribbling: item.BonusDribbling,
	}

	total := domain.CardStats{
		Shooting:  base.Shooting + bonus.Shooting,
		Passing:   base.Passing + bonus.Passing,
		Pace:      base.Pace + bonus.Pace,
		Physical:  base.Physical + bonus.Physical,
		Defending: base.Defending + bonus.Defending,
		Dribbling: base.Dribbling + bonus.Dribbling,
	}
	overall := float64(total.Shooting+total.Passing+total.Pace+total.Physical+total.Defending+total.Dribbling) / 6.0

	return domain.PlayerCard{
		UserPlayerID:     item.UserPlayerID,
		PlayerTemplateID: item.PlayerTemplateID,
		Name:             item.Name,
		HeightCM:         item.HeightCM,
		BaseClub:         item.BaseClub,
		Season:           item.Season,
		Level:            item.Level,
		Exp:              item.Exp,
		CurrentPoints:    item.CurrentPoints,
		Country: domain.Country{
			ID:   item.CountryID,
			Name: item.CountryName,
			Code: item.CountryCode,
			Flag: item.CountryFlag,
		},
		BaseStats:  base,
		BonusStats: bonus,
		TotalStats: total,
		Overall:    overall,
	}
}
