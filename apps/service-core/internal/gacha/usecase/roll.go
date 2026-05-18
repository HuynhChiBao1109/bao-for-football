package usecase

import (
	"context"
	"errors"
	"math/rand"
	"time"

	"fifam/apps/service-core/internal/gacha/domain"
	"fifam/apps/service-core/internal/gacha/repository/mysql"
)

const RollCost = int64(360000)

type repository interface {
	GetProgress(ctx context.Context, userID uint64, bannerCode string) (int, int, error)
	SaveRoll(ctx context.Context, userID uint64, bannerCode string, rarity string, pityTriggered bool, nextTotal int, rollsSinceSpecial int) error
	GetBannerPlayers(ctx context.Context, bannerCode string) ([]mysql.PlayerInBanner, error)
	GetTeamBudget(ctx context.Context, userID uint64) (int64, error)
	DeductBudget(ctx context.Context, userID uint64, amount int64) error
	AddUserPlayer(ctx context.Context, userID uint64, playerTemplateID uint64) (uint64, error)
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

func (u *RollUseCase) GetProgress(ctx context.Context, userID uint64, bannerCode string) (int, int, error) {
	return u.repo.GetProgress(ctx, userID, bannerCode)
}

func (u *RollUseCase) Execute(ctx context.Context, userID uint64, bannerCode string) (domain.RollResult, error) {
	if userID == 0 {
		return domain.RollResult{}, errors.New("userId is required")
	}
	if bannerCode == "" {
		return domain.RollResult{}, errors.New("bannerCode is required")
	}

	// Check budget
	budget, err := u.repo.GetTeamBudget(ctx, userID)
	if err != nil {
		return domain.RollResult{}, err
	}
	if budget < RollCost {
		return domain.RollResult{}, errors.New("insufficient budget for roll")
	}

	// Get players in banner
	players, err := u.repo.GetBannerPlayers(ctx, bannerCode)
	if err != nil {
		return domain.RollResult{}, err
	}
	if len(players) == 0 {
		return domain.RollResult{}, errors.New("no players in banner")
	}

	// Get roll progress
	totalRolls, rollsSinceLastSpecial, err := u.repo.GetProgress(ctx, userID, bannerCode)
	if err != nil {
		return domain.RollResult{}, err
	}

	// Determine rarity
	isSpecial, pityTriggered := rollRarity(u.rng.Float64(), rollsSinceLastSpecial)
	rarity := "R"
	season := "Normal"
	nextSince := rollsSinceLastSpecial + 1
	if isSpecial {
		rarity = "SSR"
		season = "Special"
		nextSince = 0
	}

	// Pick random player
	selectedPlayer := players[u.rng.Intn(len(players))]

	// Deduct budget
	if err := u.repo.DeductBudget(ctx, userID, RollCost); err != nil {
		return domain.RollResult{}, err
	}

	// Add player to user_players
	_, err = u.repo.AddUserPlayer(ctx, userID, selectedPlayer.PlayerID)
	if err != nil {
		return domain.RollResult{}, err
	}

	// Save roll log
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
		NextRollGuaranteedHint: nextSince >= 70,
		PlayerID:               selectedPlayer.PlayerID,
		PlayerName:             selectedPlayer.Name,
		PlayerImageURL:         selectedPlayer.ImageURL,
		CostDeducted:           RollCost,
	}, nil
}

func rollRarity(randValue float64, rollsSinceLastSpecial int) (bool, bool) {
	// 80-90 rolls guaranteed to get a special player
	if rollsSinceLastSpecial >= 80 {
		return true, true
	}

	if randValue < 0.10 {
		return true, false
	}

	return false, false
}
