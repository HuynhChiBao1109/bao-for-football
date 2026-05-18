package mysql

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"fifam/apps/service-core/internal/gachaadmin/domain"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateBanner(ctx context.Context, input domain.BannerConfig) (domain.BannerConfig, error) {
	if r.db == nil {
		return domain.BannerConfig{}, errors.New("database is not configured")
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO gacha_banners (
  banner_code,
  banner_name,
  banner_image_data,
  player_id,
  created_at
) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		input.BannerCode,
		input.BannerName,
		input.BannerImageURL,
		input.PlayerID,
	)
	if err != nil {
		return domain.BannerConfig{}, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return domain.BannerConfig{}, err
	}

	input.ID = uint64(id)
	if input.CreatedAt.IsZero() {
		input.CreatedAt = time.Now()
	}

	return input, nil
}
