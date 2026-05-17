package usecase

import (
	"context"
	"errors"
	"strings"

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

	return u.repo.CreateBanner(ctx, input)
}
