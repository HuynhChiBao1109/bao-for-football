package usecase

import (
	"context"
	"errors"
	"strings"

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
	teamID = strings.ToLower(strings.TrimSpace(teamID))
	if teamID != "home" && teamID != "away" {
		return nil, errors.New("teamId must be home or away")
	}

	return u.repo.FindByTeamID(ctx, teamID)
}