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
) VALUES (?, ?, ?, 51, ?, ?)`,
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
