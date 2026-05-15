package usecase

import (
	"context"
	"errors"
	"strings"

	"fifam/apps/service-core/internal/playeradmin/domain"
)

type repository interface {
	List(ctx context.Context) ([]domain.Player, error)
	GetByID(ctx context.Context, id int64) (domain.Player, error)
	ListCountries(ctx context.Context) ([]domain.Country, error)
	Create(ctx context.Context, input domain.Player) (domain.Player, error)
}

type PlayerAdminUseCase struct {
	repo repository
}

func NewPlayerAdminUseCase(repo repository) *PlayerAdminUseCase {
	return &PlayerAdminUseCase{repo: repo}
}

func (u *PlayerAdminUseCase) List(ctx context.Context) ([]domain.Player, error) {
	return u.repo.List(ctx)
}

func (u *PlayerAdminUseCase) GetByID(ctx context.Context, id int64) (domain.Player, error) {
	if id <= 0 {
		return domain.Player{}, errors.New("id is invalid")
	}

	return u.repo.GetByID(ctx, id)
}

func (u *PlayerAdminUseCase) ListCountries(ctx context.Context) ([]domain.Country, error) {
	return u.repo.ListCountries(ctx)
}

func (u *PlayerAdminUseCase) Create(ctx context.Context, input domain.Player) (domain.Player, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.BaseClub = strings.TrimSpace(input.BaseClub)
	input.SpecialSkill = strings.TrimSpace(input.SpecialSkill)
	input.Season = strings.TrimSpace(input.Season)
	input.SourceType = strings.TrimSpace(strings.ToLower(input.SourceType))

	if input.Name == "" {
		return domain.Player{}, errors.New("name is required")
	}
	if input.CountryID <= 0 {
		return domain.Player{}, errors.New("countryId is required")
	}
	if input.BaseClub == "" {
		return domain.Player{}, errors.New("baseClub is required")
	}
	if input.Season != "Normal" && input.Season != "Special" {
		return domain.Player{}, errors.New("season must be Normal or Special")
	}
	if input.SourceType != "normal" && input.SourceType != "gacha" {
		return domain.Player{}, errors.New("sourceType must be normal or gacha")
	}

	if input.LongPass == 0 {
		input.LongPass = input.Passing
	}
	if input.Vision == 0 {
		input.Vision = input.Passing
	}

	for _, stat := range []struct {
		name  string
		value int
	}{
		{"shooting", input.Shooting},
		{"passing", input.Passing},
		{"longPass", input.LongPass},
		{"vision", input.Vision},
		{"pace", input.Pace},
		{"physical", input.Physical},
		{"defending", input.Defending},
		{"dribbling", input.Dribbling},
	} {
		if stat.value < 1 || stat.value > 99 {
			return domain.Player{}, errors.New(stat.name + " must be between 1 and 99")
		}
	}

	return u.repo.Create(ctx, input)
}
