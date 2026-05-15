package usecase

import (
	"context"
	"errors"
	"strings"

	"fifam/apps/service-core/internal/tactics/domain"
)

type repository interface {
	Save(ctx context.Context, cfg domain.Config) (domain.Config, error)
}

type realtimePusher interface {
	Push(ctx context.Context, cfg domain.Config) error
}

type SaveTacticsUseCase struct {
	repo   repository
	pusher realtimePusher
}

func NewSaveTacticsUseCase(repo repository, pusher realtimePusher) *SaveTacticsUseCase {
	return &SaveTacticsUseCase{repo: repo, pusher: pusher}
}

func (u *SaveTacticsUseCase) Execute(ctx context.Context, cfg domain.Config) (domain.Config, error) {
	cfg.TeamID = strings.ToLower(strings.TrimSpace(cfg.TeamID))
	cfg.Formation = strings.TrimSpace(cfg.Formation)

	if cfg.TeamID != "home" && cfg.TeamID != "away" {
		return domain.Config{}, errors.New("teamId must be home or away")
	}

	if cfg.Formation != "4-3-3" && cfg.Formation != "4-4-2" {
		return domain.Config{}, errors.New("formation must be 4-3-3 or 4-4-2")
	}

	if cfg.PassRatio < 0 || cfg.PassRatio > 100 {
		return domain.Config{}, errors.New("passRatio must be between 0 and 100")
	}
	if cfg.ShotRatio < 0 || cfg.ShotRatio > 100 {
		return domain.Config{}, errors.New("shotRatio must be between 0 and 100")
	}
	if cfg.Pressure < 0 || cfg.Pressure > 100 {
		return domain.Config{}, errors.New("pressure must be between 0 and 100")
	}

	normalized := domain.Config{
		TeamID:    cfg.TeamID,
		Formation: cfg.Formation,
		PassRatio: cfg.PassRatio / 100.0,
		ShotRatio: cfg.ShotRatio / 100.0,
		Pressure:  cfg.Pressure / 100.0,
	}

	saved, err := u.repo.Save(ctx, normalized)
	if err != nil {
		return domain.Config{}, err
	}

	if err := u.pusher.Push(ctx, saved); err != nil {
		return domain.Config{}, err
	}

	return saved, nil
}
