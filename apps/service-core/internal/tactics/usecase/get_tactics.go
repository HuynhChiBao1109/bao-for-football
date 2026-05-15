package usecase

import (
	"context"

	"fifam/apps/service-core/internal/tactics/domain"
)

type tacticsReader interface {
	FindByTeamID(ctx context.Context, teamID string) (*domain.Config, error)
}

type GetTacticsUseCase struct {
	repo tacticsReader
}

func NewGetTacticsUseCase(repo tacticsReader) *GetTacticsUseCase {
	return &GetTacticsUseCase{repo: repo}
}

func (u *GetTacticsUseCase) Execute(ctx context.Context, teamID string) (*domain.Config, error) {
	normalizedID, err := normalizeTeamID(teamID)
	if err != nil {
		return nil, err
	}

	return u.repo.FindByTeamID(ctx, normalizedID)
}
