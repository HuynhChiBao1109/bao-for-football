package usecase

import (
	"context"
	"errors"
	"strings"

	"fifam/apps/service-core/internal/playeradmin/domain"
)

type repository interface {
	List(ctx context.Context, filter domain.PlayerFilter) ([]domain.Player, error)
	GetByID(ctx context.Context, id int64) (domain.Player, error)
	ListSkills(ctx context.Context) ([]domain.SpecialSkill, error)
	CreateSkill(ctx context.Context, input domain.SpecialSkill) (domain.SpecialSkill, error)
	AssignSkillToPlayer(ctx context.Context, playerID int64, skillName string) (domain.Player, error)
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

func (u *PlayerAdminUseCase) List(ctx context.Context, filter domain.PlayerFilter) ([]domain.Player, error) {
	filter.Name = strings.TrimSpace(filter.Name)
	filter.BaseClub = strings.TrimSpace(filter.BaseClub)

	return u.repo.List(ctx, filter)
}

func (u *PlayerAdminUseCase) GetByID(ctx context.Context, id int64) (domain.Player, error) {
	if id <= 0 {
		return domain.Player{}, errors.New("id is invalid")
	}

	return u.repo.GetByID(ctx, id)
}

func (u *PlayerAdminUseCase) ListSkills(ctx context.Context) ([]domain.SpecialSkill, error) {
	return u.repo.ListSkills(ctx)
}

func (u *PlayerAdminUseCase) CreateSkill(ctx context.Context, input domain.SpecialSkill) (domain.SpecialSkill, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.IconURL = strings.TrimSpace(input.IconURL)
	input.BuffType = strings.TrimSpace(input.BuffType)

	if input.Name == "" {
		return domain.SpecialSkill{}, errors.New("skill name is required")
	}
	if input.BuffType == "" {
		return domain.SpecialSkill{}, errors.New("buffType is required")
	}
	if input.BuffValue == 0 {
		return domain.SpecialSkill{}, errors.New("buffValue must not be 0")
	}

	validBuffTypes := map[string]struct{}{
		"shooting": {}, "passing": {}, "longPass": {}, "vision": {}, "gkReach": {},
		"attackingAwareness": {}, "defensiveAwareness": {}, "gkParrying": {}, "gkReflex": {},
		"duels": {}, "standingTackle": {}, "slidingTackle": {}, "pace": {}, "stamina": {},
		"balance": {}, "technique": {}, "determination": {}, "strength": {}, "dribbling": {}, "curve": {},
	}
	if _, ok := validBuffTypes[input.BuffType]; !ok {
		return domain.SpecialSkill{}, errors.New("buffType is invalid")
	}

	return u.repo.CreateSkill(ctx, input)
}

func (u *PlayerAdminUseCase) AssignSkillToPlayer(ctx context.Context, playerID int64, skillName string) (domain.Player, error) {
	if playerID <= 0 {
		return domain.Player{}, errors.New("player id is invalid")
	}

	skillName = strings.TrimSpace(skillName)
	if skillName == "" {
		return domain.Player{}, errors.New("skillName is required")
	}

	return u.repo.AssignSkillToPlayer(ctx, playerID, skillName)
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
	if input.ClubID <= 0 {
		return domain.Player{}, errors.New("clubId is required")
	}
	validSeason := map[string]struct{}{
		"normal":        {},
		"special year":  {},
		"special match": {},
		"moment time":   {},
	}
	if _, ok := validSeason[strings.ToLower(input.Season)]; !ok {
		return domain.Player{}, errors.New("season must be one of: normal, special year, special match, moment time")
	}
	input.Season = strings.ToLower(input.Season)

	if input.LongPass == 0 {
		input.LongPass = input.Passing
	}
	if input.Vision == 0 {
		input.Vision = input.Passing
	}
	if input.GKReach == 0 {
		input.GKReach = input.DefAwareness
	}
	if input.AttAwareness == 0 {
		input.AttAwareness = input.Vision
	}
	if input.GKParrying == 0 {
		input.GKParrying = input.DefAwareness
	}
	if input.GKReflex == 0 {
		input.GKReflex = input.DefAwareness
	}
	if input.Duels == 0 {
		input.Duels = input.Strength
	}
	if input.Stamina == 0 {
		input.Stamina = input.Pace
	}
	if input.Balance == 0 {
		input.Balance = input.Dribbling
	}
	if input.Technique == 0 {
		input.Technique = input.Dribbling
	}
	if input.Determination == 0 {
		input.Determination = input.AttAwareness
	}
	if input.StandingTackle == 0 {
		input.StandingTackle = input.DefAwareness
	}
	if input.SlidingTackle == 0 {
		input.SlidingTackle = input.DefAwareness
	}
	if input.Curve == 0 {
		input.Curve = input.Passing
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
		{"attackingAwareness", input.AttAwareness},
		{"defensiveAwareness", input.DefAwareness},
		{"gkParrying", input.GKParrying},
		{"gkReflex", input.GKReflex},
		{"duels", input.Duels},
		{"pace", input.Pace},
		{"stamina", input.Stamina},
		{"balance", input.Balance},
		{"technique", input.Technique},
		{"determination", input.Determination},
		{"strength", input.Strength},
		{"standingTackle", input.StandingTackle},
		{"slidingTackle", input.SlidingTackle},
		{"dribbling", input.Dribbling},
		{"curve", input.Curve},
	} {
		if stat.value < 1 || stat.value > 99 {
			return domain.Player{}, errors.New(stat.name + " must be between 1 and 99")
		}
	}

	return u.repo.Create(ctx, input)
}
