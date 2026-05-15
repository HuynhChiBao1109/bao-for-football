package usecase

import (
	"context"

	"fifam/apps/service-core/internal/club/domain"
)

type GetClubUseCase struct {
	repo domain.Repository
}

func NewGetClubUseCase(repo domain.Repository) *GetClubUseCase {
	return &GetClubUseCase{repo: repo}
}

func (u *GetClubUseCase) Execute(ctx context.Context, id int64) (*domain.Club, error) {
	return u.repo.GetByID(ctx, id)
}
