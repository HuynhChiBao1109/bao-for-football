package mysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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

	if err := r.SyncExpiredBanners(ctx); err != nil {
		return domain.BannerConfig{}, err
	}

	status := input.Status
	if status == 0 {
		status = domain.BannerStatusRunning
	}

	var expiredAtParam any = nil
	if input.ExpiredAt != nil && !input.ExpiredAt.IsZero() {
		expiredAtParam = *input.ExpiredAt
	}

	result, err := r.db.ExecContext(ctx, `
INSERT INTO gacha_banners (
  banner_code,
  banner_name,
  banner_image_data,
  expired_at,
  status,
  player_id,
  created_at
) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		input.BannerCode,
		input.BannerName,
		input.BannerImageURL,
		expiredAtParam,
		status,
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
	input.Status = status
	input.StatusLabel = domain.BannerStatusText(status)

	return input, nil
}

func (r *Repository) SyncExpiredBanners(ctx context.Context) error {
	if r.db == nil {
		return nil
	}

	_, err := r.db.ExecContext(ctx, `
UPDATE gacha_banners
SET status = ?
WHERE expired_at IS NOT NULL
  AND expired_at <= CURRENT_TIMESTAMP
  AND status <> ?`, domain.BannerStatusExpired, domain.BannerStatusExpired)
	if err != nil {
		return fmt.Errorf("sync expired banners: %w", err)
	}

	return nil
}
