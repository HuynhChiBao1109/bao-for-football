package usecase

import (
	"context"
	"errors"

	"fifam/apps/service-core/internal/player/domain"
)

const (
	maxLevel         = 36
	pointsPerLevelUp = 5
)

type repository interface {
	ListByUserID(ctx context.Context, userID uint64) ([]domain.PlayerCard, error)
	FindByUserPlayerID(ctx context.Context, userID uint64, userPlayerID uint64) (domain.PlayerCard, error)
	LevelUp(ctx context.Context, userID uint64, userPlayerID uint64, requiredExp uint32, grantPoints uint32) error
	AllocateStats(ctx context.Context, userID uint64, userPlayerID uint64, input domain.AllocateStatsInput, deltaPoints int32) error
}

type PlayerCardUseCase struct {
	repo repository
}

func NewPlayerCardUseCase(repo repository) *PlayerCardUseCase {
	return &PlayerCardUseCase{repo: repo}
}

func (u *PlayerCardUseCase) ListMyCards(ctx context.Context, userID uint64) ([]domain.PlayerCard, error) {
	if userID == 0 {
		return nil, errors.New("invalid user")
	}

	cards, err := u.repo.ListByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	for i := range cards {
		updated, err := u.syncAutoLevel(ctx, userID, cards[i])
		if err != nil {
			return nil, err
		}
		cards[i] = updated
	}

	return cards, nil
}

func (u *PlayerCardUseCase) LevelUp(ctx context.Context, userID uint64, userPlayerID uint64) (domain.PlayerCard, error) {
	if userID == 0 || userPlayerID == 0 {
		return domain.PlayerCard{}, errors.New("invalid request")
	}

	card, err := u.repo.FindByUserPlayerID(ctx, userID, userPlayerID)
	if err != nil {
		return domain.PlayerCard{}, err
	}
	if card.Level >= maxLevel {
		return domain.PlayerCard{}, errors.New("player already max level")
	}

	required := requiredExpForLevel(card.Level)
	if card.Exp < required {
		return domain.PlayerCard{}, errors.New("not enough exp to level up")
	}

	if err := u.repo.LevelUp(ctx, userID, userPlayerID, required, pointsPerLevelUp); err != nil {
		return domain.PlayerCard{}, err
	}

	updated, err := u.repo.FindByUserPlayerID(ctx, userID, userPlayerID)
	if err != nil {
		return domain.PlayerCard{}, err
	}
	attachLevelProgress(&updated)

	return updated, nil
}

func (u *PlayerCardUseCase) AllocateStats(ctx context.Context, userID uint64, userPlayerID uint64, input domain.AllocateStatsInput) (domain.PlayerCard, error) {
	if userID == 0 || userPlayerID == 0 {
		return domain.PlayerCard{}, errors.New("invalid request")
	}

	delta := int32(
		input.Shooting +
			input.Passing +
			input.LongPass +
			input.Vision +
			input.DefensiveAwareness +
			input.CounterAttackAwareness +
			input.CrossbarHandling +
			input.Reflexes +
			input.AerialCatching +
			input.Duels +
			input.Pace +
			input.Physical +
			input.Defending +
			input.Dribbling,
	)
	if delta == 0 {
		return domain.PlayerCard{}, errors.New("no stats changes")
	}

	card, err := u.repo.FindByUserPlayerID(ctx, userID, userPlayerID)
	if err != nil {
		return domain.PlayerCard{}, err
	}

	card, err = u.syncAutoLevel(ctx, userID, card)
	if err != nil {
		return domain.PlayerCard{}, err
	}

	for _, item := range []struct {
		name  string
		base  int
		delta int
	}{
		{name: "shooting", base: card.BonusStats.Shooting, delta: input.Shooting},
		{name: "passing", base: card.BonusStats.Passing, delta: input.Passing},
		{name: "longPass", base: card.BonusStats.LongPass, delta: input.LongPass},
		{name: "vision", base: card.BonusStats.Vision, delta: input.Vision},
		{name: "defensiveAwareness", base: card.BonusStats.DefensiveAwareness, delta: input.DefensiveAwareness},
		{name: "counterAttackAwareness", base: card.BonusStats.CounterAttackAwareness, delta: input.CounterAttackAwareness},
		{name: "crossbarHandling", base: card.BonusStats.CrossbarHandling, delta: input.CrossbarHandling},
		{name: "reflexes", base: card.BonusStats.Reflexes, delta: input.Reflexes},
		{name: "aerialCatching", base: card.BonusStats.AerialCatching, delta: input.AerialCatching},
		{name: "duels", base: card.BonusStats.Duels, delta: input.Duels},
		{name: "pace", base: card.BonusStats.Pace, delta: input.Pace},
		{name: "physical", base: card.BonusStats.Physical, delta: input.Physical},
		{name: "defending", base: card.BonusStats.Defending, delta: input.Defending},
		{name: "dribbling", base: card.BonusStats.Dribbling, delta: input.Dribbling},
	} {
		if item.base+item.delta < 0 {
			return domain.PlayerCard{}, errors.New(item.name + " cannot be below 0")
		}
	}

	remaining := int64(card.CurrentPoints) - int64(delta)
	if remaining < 0 {
		return domain.PlayerCard{}, errors.New("not enough current points")
	}

	if err := u.repo.AllocateStats(ctx, userID, userPlayerID, input, delta); err != nil {
		return domain.PlayerCard{}, err
	}

	updated, err := u.repo.FindByUserPlayerID(ctx, userID, userPlayerID)
	if err != nil {
		return domain.PlayerCard{}, err
	}
	attachLevelProgress(&updated)

	return updated, nil
}

func (u *PlayerCardUseCase) syncAutoLevel(ctx context.Context, userID uint64, card domain.PlayerCard) (domain.PlayerCard, error) {
	current := card

	for current.Level < maxLevel {
		required := requiredExpForLevel(current.Level)
		if required == 0 || current.Exp < required {
			break
		}

		if err := u.repo.LevelUp(ctx, userID, current.UserPlayerID, required, pointsPerLevelUp); err != nil {
			return domain.PlayerCard{}, err
		}

		next, err := u.repo.FindByUserPlayerID(ctx, userID, current.UserPlayerID)
		if err != nil {
			return domain.PlayerCard{}, err
		}
		current = next
	}

	attachLevelProgress(&current)
	return current, nil
}

func attachLevelProgress(card *domain.PlayerCard) {
	if card == nil {
		return
	}

	if card.Level >= maxLevel {
		card.RequiredExpForNext = 0
		card.ExpProgressPercent = 100
		card.CanLevelUp = false
		return
	}

	required := requiredExpForLevel(card.Level)
	card.RequiredExpForNext = required
	if required == 0 {
		card.ExpProgressPercent = 0
		card.CanLevelUp = false
		return
	}

	progress := (float64(card.Exp) / float64(required)) * 100
	if progress > 100 {
		progress = 100
	}
	card.ExpProgressPercent = progress
	card.CanLevelUp = card.Exp >= required
}

func requiredExpForLevel(level uint8) uint32 {
	if level >= maxLevel {
		return 0
	}
	if level == 0 {
		level = 1
	}
	return 100 + uint32(level-1)*50
}
