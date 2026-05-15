package usecase

import (
	"context"
	"errors"

	"fifam/apps/service-core/internal/ai/domain"
)

type repository interface {
	EnsureUserStages(ctx context.Context, userID uint64) error
	ListStages(ctx context.Context, userID uint64) ([]domain.Stage, error)
	GetStageDetail(ctx context.Context, userID uint64, stageNo int) (*domain.StageDetail, error)
	ApplyStageResult(ctx context.Context, userID uint64, stageNo int, isWin bool) (domain.StageResult, error)
}

type CampaignUseCase struct {
	repo repository
}

func NewCampaignUseCase(repo repository) *CampaignUseCase {
	return &CampaignUseCase{repo: repo}
}

func (u *CampaignUseCase) ListStages(ctx context.Context, userID uint64) ([]domain.Stage, error) {
	if userID == 0 {
		return nil, errors.New("userId is required")
	}

	if err := u.repo.EnsureUserStages(ctx, userID); err != nil {
		return nil, err
	}

	return u.repo.ListStages(ctx, userID)
}

func (u *CampaignUseCase) GetStageDetail(ctx context.Context, userID uint64, stageNo int) (*domain.StageDetail, error) {
	if userID == 0 {
		return nil, errors.New("userId is required")
	}
	if stageNo < 1 || stageNo > domain.TotalStages {
		return nil, errors.New("stageNo must be between 1 and 50")
	}

	if err := u.repo.EnsureUserStages(ctx, userID); err != nil {
		return nil, err
	}

	return u.repo.GetStageDetail(ctx, userID, stageNo)
}

func (u *CampaignUseCase) SubmitStageResult(ctx context.Context, userID uint64, stageNo int, isWin bool) (domain.StageResult, error) {
	if userID == 0 {
		return domain.StageResult{}, errors.New("userId is required")
	}
	if stageNo < 1 || stageNo > domain.TotalStages {
		return domain.StageResult{}, errors.New("stageNo must be between 1 and 50")
	}

	if err := u.repo.EnsureUserStages(ctx, userID); err != nil {
		return domain.StageResult{}, err
	}

	return u.repo.ApplyStageResult(ctx, userID, stageNo, isWin)
}
