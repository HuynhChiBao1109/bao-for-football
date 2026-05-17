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
	CreateCountry(ctx context.Context, input domain.Country) (domain.Country, error)
	CreateClub(ctx context.Context, input domain.Club) (domain.Club, error)
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

func (u *PlayerAdminUseCase) CreateCountry(ctx context.Context, input domain.Country) (domain.Country, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Code = strings.TrimSpace(strings.ToUpper(input.Code))
	input.Flag = strings.TrimSpace(input.Flag)

	if input.Name == "" {
		return domain.Country{}, errors.New("country name is required")
	}

	return u.repo.CreateCountry(ctx, input)
}

func (u *PlayerAdminUseCase) CreateClub(ctx context.Context, input domain.Club) (domain.Club, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Logo = strings.TrimSpace(input.Logo)
	input.LeagueName = strings.TrimSpace(input.LeagueName)

	if input.Name == "" {
		return domain.Club{}, errors.New("club name is required")
	}
	if input.CountryID == nil || *input.CountryID <= 0 {
		return domain.Club{}, errors.New("countryId is required")
	}
	if input.LeagueName == "" {
		return domain.Club{}, errors.New("leagueName is required")
	}
	if input.Budget < 0 {
		return domain.Club{}, errors.New("budget must be non-negative")
	}

	return u.repo.CreateClub(ctx, input)
}

func (u *PlayerAdminUseCase) Create(ctx context.Context, input domain.Player) (domain.Player, error) {
	input.Name = strings.TrimSpace(input.Name)
	if input.Avatar != nil {
		trimmedAvatar := strings.TrimSpace(*input.Avatar)
		if trimmedAvatar == "" {
			input.Avatar = nil
		} else {
			input.Avatar = &trimmedAvatar
		}
	}
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
	if input.GKReach == 0 {
		input.GKReach = input.Defending
	}
	if input.CtrAwareness == 0 {
		input.CtrAwareness = input.Vision
	}
	if input.GKParrying == 0 {
		input.GKParrying = input.Defending
	}
	if input.GKReflex == 0 {
		input.GKReflex = input.Defending
	}
	if input.GKCatching == 0 {
		input.GKCatching = input.Physical
	}
	if input.Duels == 0 {
		input.Duels = input.Physical
	}
	if input.StandingTackle == 0 {
		input.StandingTackle = input.Defending
	}
	if input.SlidingTackle == 0 {
		input.SlidingTackle = input.Defending
	}

	for _, stat := range []struct {
		name  string
		value int
	}{
		{"shooting", input.Shooting},
		{"passing", input.Passing},
		{"longPass", input.LongPass},
		{"vision", input.Vision},
		{"gkReach", input.GKReach},
		{"counterAttackAwareness", input.CtrAwareness},
		{"gkParrying", input.GKParrying},
		{"gkReflex", input.GKReflex},
		{"gkCatching", input.GKCatching},
		{"duels", input.Duels},
		{"pace", input.Pace},
		{"physical", input.Physical},
		{"defending", input.Defending},
		{"standingTackle", input.StandingTackle},
		{"slidingTackle", input.SlidingTackle},
		{"dribbling", input.Dribbling},
	} {
		if stat.value < 1 || stat.value > 99 {
			return domain.Player{}, errors.New(stat.name + " must be between 1 and 99")
		}
	}

	return u.repo.Create(ctx, input)
}
