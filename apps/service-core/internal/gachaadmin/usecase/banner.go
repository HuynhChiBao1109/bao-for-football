package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"fifam/apps/service-core/internal/gachaadmin/domain"
)

type repository interface {
	CreateBanner(ctx context.Context, input domain.BannerConfig) (domain.BannerConfig, error)
}

type BannerUseCase struct {
	repo repository
}

func NewBannerUseCase(repo repository) *BannerUseCase {
	return &BannerUseCase{repo: repo}
}

func (u *BannerUseCase) CreateBanner(ctx context.Context, input domain.BannerConfig) (domain.BannerConfig, error) {
	input.BannerCode = strings.TrimSpace(input.BannerCode)
	input.BannerName = strings.TrimSpace(input.BannerName)
	input.BannerImageURL = strings.TrimSpace(input.BannerImageURL)
	if input.ExpiredAt == nil || input.ExpiredAt.IsZero() {
		return domain.BannerConfig{}, errors.New("timeEnd is required")
	}
	if input.ExpiredAt.Before(time.Now()) {
		input.Status = domain.BannerStatusExpired
	} else {
		input.Status = domain.BannerStatusRunning
	}

	if input.BannerCode == "" {
		return domain.BannerConfig{}, errors.New("bannerCode is required")
	}
	if input.BannerName == "" {
		return domain.BannerConfig{}, errors.New("bannerName is required")
	}
	if input.BannerImageURL == "" {
		return domain.BannerConfig{}, errors.New("bannerImageUrl is required")
	}
	if input.PlayerID <= 0 {
		return domain.BannerConfig{}, errors.New("playerId is required")
	}
	input.StatusLabel = domain.BannerStatusText(input.Status)

	return u.repo.CreateBanner(ctx, input)
}
