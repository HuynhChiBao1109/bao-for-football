package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
)

type Repository struct {
	db    *sql.DB
	memMu sync.Mutex
	mem   map[string]progress
}

type progress struct {
	totalRolls        int
	rollsSinceSpecial int
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{
		db:  db,
		mem: make(map[string]progress),
	}
}

func (r *Repository) GetProgress(ctx context.Context, userID uint64, bannerCode string) (int, int, error) {
	if r.db == nil {
		key := makeKey(userID, bannerCode)
		r.memMu.Lock()
		p := r.mem[key]
		r.memMu.Unlock()
		return p.totalRolls, p.rollsSinceSpecial, nil
	}

	var total int
	if err := r.db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM gacha_logs
WHERE user_id = ? AND banner_code = ?`, userID, bannerCode).Scan(&total); err != nil {
		return 0, 0, err
	}

	var since int
	err := r.db.QueryRowContext(ctx, `
SELECT pull_count_since_last_high_rarity
FROM gacha_logs
WHERE user_id = ? AND banner_code = ?
ORDER BY id DESC
LIMIT 1`, userID, bannerCode).Scan(&since)
	if err != nil {
		if err == sql.ErrNoRows {
			return total, 0, nil
		}
		return 0, 0, err
	}

	return total, since, nil
}

func (r *Repository) SaveRoll(ctx context.Context, userID uint64, bannerCode string, rarity string, pityTriggered bool, nextTotal int, rollsSinceSpecial int) error {
	if r.db == nil {
		key := makeKey(userID, bannerCode)
		r.memMu.Lock()
		r.mem[key] = progress{totalRolls: nextTotal, rollsSinceSpecial: rollsSinceSpecial}
		r.memMu.Unlock()
		return nil
	}

	_, err := r.db.ExecContext(ctx, `
INSERT INTO gacha_logs (
  user_id,
  banner_code,
  pull_count_since_last_high_rarity,
  pity_threshold,
  is_pity_triggered,
  rarity
) VALUES (?, ?, ?, 80, ?, ?)`,
		userID,
		bannerCode,
		rollsSinceSpecial,
		pityTriggered,
		rarity,
	)
	return err
}

func makeKey(userID uint64, bannerCode string) string {
	return fmt.Sprintf("%s#%d", bannerCode, userID)
}

type PlayerInBanner struct {
	PlayerID   uint64
	Name       string
	ImageURL   string
}

func (r *Repository) GetBannerPlayers(ctx context.Context, bannerCode string) ([]PlayerInBanner, error) {
	query := `
SELECT pt.id, pt.name, pt.image_url
FROM gacha_banners gb
JOIN player_templates pt ON gb.player_id = pt.id
WHERE gb.banner_code = ? AND gb.status = 1
ORDER BY gb.id ASC`
	
	rows, err := r.db.QueryContext(ctx, query, bannerCode)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []PlayerInBanner
	for rows.Next() {
		var p PlayerInBanner
		if err := rows.Scan(&p.PlayerID, &p.Name, &p.ImageURL); err != nil {
			return nil, err
		}
		players = append(players, p)
	}
	return players, rows.Err()
}

func (r *Repository) GetTeamBudget(ctx context.Context, userID uint64) (int64, error) {
	var budget int64
	err := r.db.QueryRowContext(ctx, `
SELECT budget FROM teams WHERE user_id = ?`, userID).Scan(&budget)
	if err != nil {
		if err == sql.ErrNoRows {
			return 0, fmt.Errorf("team not found for user %d", userID)
		}
		return 0, err
	}
	return budget, nil
}

func (r *Repository) DeductBudget(ctx context.Context, userID uint64, amount int64) error {
	_, err := r.db.ExecContext(ctx, `
UPDATE teams SET budget = budget - ? WHERE user_id = ? AND budget >= ?`,
		amount, userID, amount)
	return err
}

func (r *Repository) AddUserPlayer(ctx context.Context, userID uint64, playerTemplateID uint64) (uint64, error) {
	result, err := r.db.ExecContext(ctx, `
INSERT INTO user_players (
  user_id,
  player_template_id,
  level,
  exp,
  current_points,
  obtained_at,
  created_at,
  updated_at
) VALUES (?, ?, 1, 0, 0, NOW(), NOW(), NOW())`,
		userID, playerTemplateID)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	return uint64(id), nil
}
