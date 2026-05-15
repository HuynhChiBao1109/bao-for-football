package usecase

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"fifam/apps/service-core/internal/gacha/domain"
)

type repository interface {
	GetProgress(ctx context.Context, userID uint64, bannerCode string) (int, int, error)
	SaveRoll(ctx context.Context, userID uint64, bannerCode string, rarity string, pityTriggered bool, nextTotal int, rollsSinceSpecial int) error
}

type RollUseCase struct {
	repo repository
	rng  *rand.Rand
}

func NewRollUseCase(repo repository) *RollUseCase {
	return &RollUseCase{
		repo: repo,
		rng:  rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (u *RollUseCase) Execute(ctx context.Context, userID uint64, bannerCode string) (domain.RollResult, error) {
	if userID == 0 {
		return domain.RollResult{}, errors.New("userId is required")
	}
	if bannerCode == "" {
		return domain.RollResult{}, errors.New("bannerCode is required")
	}

	totalRolls, rollsSinceLastSpecial, err := u.repo.GetProgress(ctx, userID, bannerCode)
	if err != nil {
		return domain.RollResult{}, err
	}

	isSpecial, pityTriggered := rollRarity(u.rng.Float64(), rollsSinceLastSpecial)
	rarity := "R"
	season := "Normal"
	nextSince := rollsSinceLastSpecial + 1
	if isSpecial {
		rarity = "SSR"
		season = "Special"
		nextSince = 0
	}

	nextTotal := totalRolls + 1
	if err := u.repo.SaveRoll(ctx, userID, bannerCode, rarity, pityTriggered, nextTotal, nextSince); err != nil {
		return domain.RollResult{}, err
	}

	return domain.RollResult{
		UserID:                 userID,
		BannerCode:             bannerCode,
		Rarity:                 rarity,
		Season:                 season,
		IsSpecial:              isSpecial,
		IsPityTriggered:        pityTriggered,
		TotalRolls:             nextTotal,
		RollsSinceLastSpecial:  nextSince,
		NextRollGuaranteedHint: nextSince >= 50,
	}, nil
}

func rollRarity(randValue float64, rollsSinceLastSpecial int) (bool, bool) {
	if rollsSinceLastSpecial >= 50 {
		return true, true
	}

	if randValue < 0.10 {
		return true, false
	}

	return false, false
}
