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
	UserPlayerID        uint64
	PlayerTemplateID    uint64
	Name                string
	ImageURL            string
	ClubImage           string
	HeightCM            uint16
	BaseClub            string
	Season              string
	Level               uint8
	Exp                 uint32
	CurrentPoints       uint32
	CountryID           int64
	CountryName         string
	CountryCode         string
	CountryFlag         string
	BaseShooting        int
	BasePassing         int
	BaseLongPass        int
	BaseVision          int
	BaseGKReach         int
	BaseAttAwareness    int
	BaseDefAwareness    int
	BaseGKParrying      int
	BaseGKReflex        int
	BaseDuels           int
	BasePace            int
	BaseStamina         int
	BaseBalance         int
	BaseTechnique       int
	BaseDetermination   int
	BaseStrength        int
	BaseStandingTackle  int
	BaseSlidingTackle   int
	BaseDribbling       int
	BaseCurve           int
	BonusShooting       int
	BonusPassing        int
	BonusLongPass       int
	BonusVision         int
	BonusGKReach        int
	BonusAttAwareness   int
	BonusDefAwareness   int
	BonusGKParrying     int
	BonusGKReflex       int
	BonusDuels          int
	BonusPace           int
	BonusStamina        int
	BonusBalance        int
	BonusTechnique      int
	BonusDetermination  int
	BonusStrength       int
	BonusStandingTackle int
	BonusSlidingTackle  int
	BonusDribbling      int
	BonusCurve          int
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
	COALESCE(pt.image_url, ''),
	COALESCE(cl.logo, ''),
	pt.height_cm,
	pt.base_club,
	pt.season,
	up.level,
	up.exp,
	up.current_points,
	COALESCE(c.id, 0) AS country_id,
	COALESCE(c.name, '') AS country_name,
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	pt.base_shooting,
	pt.base_passing,
	pt.base_long_pass,
	pt.base_vision,
	pt.base_gk_reach,
	pt.base_counter_attack_awareness,
	pt.base_defending,
	pt.base_gk_parrying,
	pt.base_gk_reflex,
	pt.base_duels,
	pt.base_pace,
	pt.base_stamina,
	pt.base_balance,
	pt.base_technique,
	pt.base_determination,
	pt.base_physical,
	pt.base_standing_tackle,
	pt.base_sliding_tackle,
	pt.base_dribbling,
	pt.base_curve,
	up.bonus_shooting,
	up.bonus_passing,
	up.bonus_long_pass,
	up.bonus_vision,
	up.bonus_gk_reach,
	up.bonus_counter_attack_awareness,
	up.bonus_defending,
	up.bonus_gk_parrying,
	up.bonus_gk_reflex,
	up.bonus_duels,
	up.bonus_pace,
	up.bonus_stamina,
	up.bonus_balance,
	up.bonus_technique,
	up.bonus_determination,
	up.bonus_physical,
	up.bonus_standing_tackle,
	up.bonus_sliding_tackle,
	up.bonus_dribbling,
	up.bonus_curve
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
LEFT JOIN countries c ON c.id = pt.country_id
LEFT JOIN clubs cl ON cl.id = pt.club_id
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
	COALESCE(pt.image_url, ''),
	COALESCE(cl.logo, ''),
	pt.height_cm,
	pt.base_club,
	pt.season,
	up.level,
	up.exp,
	up.current_points,
	COALESCE(c.id, 0) AS country_id,
	COALESCE(c.name, '') AS country_name,
	COALESCE(c.code, ''),
	COALESCE(c.flag, ''),
	pt.base_shooting,
	pt.base_passing,
	pt.base_long_pass,
	pt.base_vision,
	pt.base_gk_reach,
	pt.base_counter_attack_awareness,
	pt.base_defending,
	pt.base_gk_parrying,
	pt.base_gk_reflex,
	pt.base_duels,
	pt.base_pace,
	pt.base_stamina,
	pt.base_balance,
	pt.base_technique,
	pt.base_determination,
	pt.base_physical,
	pt.base_standing_tackle,
	pt.base_sliding_tackle,
	pt.base_dribbling,
	pt.base_curve,
	up.bonus_shooting,
	up.bonus_passing,
	up.bonus_long_pass,
	up.bonus_vision,
	up.bonus_gk_reach,
	up.bonus_counter_attack_awareness,
	up.bonus_defending,
	up.bonus_gk_parrying,
	up.bonus_gk_reflex,
	up.bonus_duels,
	up.bonus_pace,
	up.bonus_stamina,
	up.bonus_balance,
	up.bonus_technique,
	up.bonus_determination,
	up.bonus_physical,
	up.bonus_standing_tackle,
	up.bonus_sliding_tackle,
	up.bonus_dribbling,
	up.bonus_curve
FROM user_players up
INNER JOIN player_templates pt ON pt.id = up.player_template_id
LEFT JOIN countries c ON c.id = pt.country_id
LEFT JOIN clubs cl ON cl.id = pt.club_id
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
	bonus_long_pass = bonus_long_pass + ?,
	bonus_vision = bonus_vision + ?,
	bonus_gk_reach = bonus_gk_reach + ?,
	bonus_counter_attack_awareness = bonus_counter_attack_awareness + ?,
	bonus_defending = bonus_defending + ?,
	bonus_gk_parrying = bonus_gk_parrying + ?,
	bonus_gk_reflex = bonus_gk_reflex + ?,
	bonus_duels = bonus_duels + ?,
	bonus_pace = bonus_pace + ?,
	bonus_stamina = bonus_stamina + ?,
	bonus_balance = bonus_balance + ?,
	bonus_technique = bonus_technique + ?,
	bonus_determination = bonus_determination + ?,
	bonus_physical = bonus_physical + ?,
	bonus_standing_tackle = bonus_standing_tackle + ?,
	bonus_sliding_tackle = bonus_sliding_tackle + ?,
	bonus_dribbling = bonus_dribbling + ?,
	bonus_curve = bonus_curve + ?,
	current_points = current_points - ?
WHERE id = ?
	AND user_id = ?
	AND bonus_shooting + ? >= 0
	AND bonus_passing + ? >= 0
	AND bonus_long_pass + ? >= 0
	AND bonus_vision + ? >= 0
	AND bonus_gk_reach + ? >= 0
	AND bonus_counter_attack_awareness + ? >= 0
	AND bonus_defending + ? >= 0
	AND bonus_gk_parrying + ? >= 0
	AND bonus_gk_reflex + ? >= 0
	AND bonus_duels + ? >= 0
	AND bonus_pace + ? >= 0
	AND bonus_stamina + ? >= 0
	AND bonus_balance + ? >= 0
	AND bonus_technique + ? >= 0
	AND bonus_determination + ? >= 0
	AND bonus_physical + ? >= 0
	AND bonus_standing_tackle + ? >= 0
	AND bonus_sliding_tackle + ? >= 0
	AND bonus_dribbling + ? >= 0
	AND bonus_curve + ? >= 0`

	args := []any{
		input.Shooting,
		input.Passing,
		input.LongPass,
		input.Vision,
		input.GKReach,
		input.AttackingAwareness,
		input.DefensiveAwareness,
		input.GKParrying,
		input.GKReflex,
		input.Duels,
		input.Pace,
		input.Stamina,
		input.Balance,
		input.Technique,
		input.Determination,
		input.Strength,
		input.StandingTackle,
		input.SlidingTackle,
		input.Dribbling,
		input.Curve,
		deltaPoints,
		userPlayerID,
		userID,
		input.Shooting,
		input.Passing,
		input.LongPass,
		input.Vision,
		input.GKReach,
		input.AttackingAwareness,
		input.DefensiveAwareness,
		input.GKParrying,
		input.GKReflex,
		input.Duels,
		input.Pace,
		input.Stamina,
		input.Balance,
		input.Technique,
		input.Determination,
		input.Strength,
		input.StandingTackle,
		input.SlidingTackle,
		input.Dribbling,
		input.Curve,
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
		&item.ImageURL,
		&item.ClubImage,
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
		&item.BaseLongPass,
		&item.BaseVision,
		&item.BaseGKReach,
		&item.BaseAttAwareness,
		&item.BaseDefAwareness,
		&item.BaseGKParrying,
		&item.BaseGKReflex,
		&item.BaseDuels,
		&item.BasePace,
		&item.BaseStamina,
		&item.BaseBalance,
		&item.BaseTechnique,
		&item.BaseDetermination,
		&item.BaseStrength,
		&item.BaseStandingTackle,
		&item.BaseSlidingTackle,
		&item.BaseDribbling,
		&item.BaseCurve,
		&item.BonusShooting,
		&item.BonusPassing,
		&item.BonusLongPass,
		&item.BonusVision,
		&item.BonusGKReach,
		&item.BonusAttAwareness,
		&item.BonusDefAwareness,
		&item.BonusGKParrying,
		&item.BonusGKReflex,
		&item.BonusDuels,
		&item.BonusPace,
		&item.BonusStamina,
		&item.BonusBalance,
		&item.BonusTechnique,
		&item.BonusDetermination,
		&item.BonusStrength,
		&item.BonusStandingTackle,
		&item.BonusSlidingTackle,
		&item.BonusDribbling,
		&item.BonusCurve,
	)
	if err != nil {
		return rawCard{}, err
	}
	return item, nil
}

func toPlayerCard(item rawCard) domain.PlayerCard {
	base := domain.CardStats{
		Shooting:               item.BaseShooting,
		Passing:                item.BasePassing,
		LongPass:               item.BaseLongPass,
		Vision:                 item.BaseVision,
		GKReach:                item.BaseGKReach,
		AttackingAwareness:     item.BaseAttAwareness,
		DefensiveAwareness:     item.BaseDefAwareness,
		GKParrying:             item.BaseGKParrying,
		GKReflex:               item.BaseGKReflex,
		Duels:                  item.BaseDuels,
		Pace:                   item.BasePace,
		Stamina:                item.BaseStamina,
		Balance:                item.BaseBalance,
		Technique:              item.BaseTechnique,
		Determination:          item.BaseDetermination,
		Strength:               item.BaseStrength,
		StandingTackle:         item.BaseStandingTackle,
		SlidingTackle:          item.BaseSlidingTackle,
		Dribbling:              item.BaseDribbling,
		Curve:                  item.BaseCurve,
	}

	bonus := domain.CardStats{
		Shooting:               item.BonusShooting,
		Passing:                item.BonusPassing,
		LongPass:               item.BonusLongPass,
		Vision:                 item.BonusVision,
		GKReach:                item.BonusGKReach,
		AttackingAwareness:     item.BonusAttAwareness,
		DefensiveAwareness:     item.BonusDefAwareness,
		GKParrying:             item.BonusGKParrying,
		GKReflex:               item.BonusGKReflex,
		Duels:                  item.BonusDuels,
		Pace:                   item.BonusPace,
		Stamina:                item.BonusStamina,
		Balance:                item.BonusBalance,
		Technique:              item.BonusTechnique,
		Determination:          item.BonusDetermination,
		Strength:               item.BonusStrength,
		StandingTackle:         item.BonusStandingTackle,
		SlidingTackle:          item.BonusSlidingTackle,
		Dribbling:              item.BonusDribbling,
		Curve:                  item.BonusCurve,
	}

	total := domain.CardStats{
		Shooting:               base.Shooting + bonus.Shooting,
		Passing:                base.Passing + bonus.Passing,
		LongPass:               base.LongPass + bonus.LongPass,
		Vision:                 base.Vision + bonus.Vision,
		GKReach:                base.GKReach + bonus.GKReach,
		AttackingAwareness:     base.AttackingAwareness + bonus.AttackingAwareness,
		DefensiveAwareness:     base.DefensiveAwareness + bonus.DefensiveAwareness,
		GKParrying:             base.GKParrying + bonus.GKParrying,
		GKReflex:               base.GKReflex + bonus.GKReflex,
		Duels:                  base.Duels + bonus.Duels,
		Pace:                   base.Pace + bonus.Pace,
		Stamina:                base.Stamina + bonus.Stamina,
		Balance:                base.Balance + bonus.Balance,
		Technique:              base.Technique + bonus.Technique,
		Determination:          base.Determination + bonus.Determination,
		Strength:               base.Strength + bonus.Strength,
		StandingTackle:         base.StandingTackle + bonus.StandingTackle,
		SlidingTackle:          base.SlidingTackle + bonus.SlidingTackle,
		Dribbling:              base.Dribbling + bonus.Dribbling,
		Curve:                  base.Curve + bonus.Curve,
	}
	overall := float64(
		total.Shooting+
			total.Passing+
			total.LongPass+
			total.Vision+
			total.GKReach+
			total.AttackingAwareness+
			total.DefensiveAwareness+
			total.GKParrying+
			total.GKReflex+
			total.Duels+
			total.Pace+
			total.Stamina+
			total.Balance+
			total.Technique+
			total.Determination+
			total.Strength+
			total.StandingTackle+
			total.SlidingTackle+
			total.Dribbling+
			total.Curve,
	) / 20.0

	return domain.PlayerCard{
		UserPlayerID:     item.UserPlayerID,
		PlayerTemplateID: item.PlayerTemplateID,
		Name:             item.Name,
		ImageURL:         item.ImageURL,
		ClubImage:        item.ClubImage,
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
