package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"fifam/apps/service-core/internal/match/domain"

	"github.com/google/uuid"
)

type repository interface {
	GetHomeClubName(ctx context.Context, userID uint64) (string, error)
	CreateMatch(ctx context.Context, start domain.MatchStart, userID uint64) error
	FinalizeMatch(ctx context.Context, input domain.FinalizeInput) (*domain.MatchResult, error)
}

type realtimeStarter interface {
	StartMatch(ctx context.Context, matchID string, homeName string, awayName string) error
}

type MatchUseCase struct {
	repo     repository
	realtime realtimeStarter
}

func NewMatchUseCase(repo repository, realtime realtimeStarter) *MatchUseCase {
	return &MatchUseCase{repo: repo, realtime: realtime}
}

func (u *MatchUseCase) Start(ctx context.Context, input domain.StartInput) (*domain.MatchStart, error) {
	if input.UserID == 0 {
		return nil, errors.New("userId is required")
	}

	homeClubName, err := u.repo.GetHomeClubName(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	homeClubName = strings.TrimSpace(homeClubName)
	if homeClubName == "" {
		return nil, errors.New("home club is required")
	}

	awayClubName := strings.TrimSpace(input.AwayClubName)
	if awayClubName == "" {
		awayClubName = "Black United"
	}

	mode := strings.TrimSpace(input.Mode)
	if mode == "" {
		mode = "casual"
	}

	matchID := uuid.NewString()
	start := domain.MatchStart{
		MatchID:      matchID,
		HomeClubName: homeClubName,
		AwayClubName: awayClubName,
		Mode:         mode,
		StageNo:      input.StageNo,
		StartedAt:    nowUTC(),
	}

	if err := u.realtime.StartMatch(ctx, matchID, homeClubName, awayClubName); err != nil {
		return nil, err
	}

	if err := u.repo.CreateMatch(ctx, start, input.UserID); err != nil {
		return nil, err
	}

	return &start, nil
}

func (u *MatchUseCase) Finalize(ctx context.Context, input domain.FinalizeInput) (*domain.MatchResult, error) {
	if input.UserID == 0 {
		return nil, errors.New("userId is required")
	}
	input.MatchID = strings.TrimSpace(input.MatchID)
	if input.MatchID == "" {
		return nil, errors.New("matchId is required")
	}
	if input.HomeScore < 0 || input.AwayScore < 0 {
		return nil, errors.New("score must be >= 0")
	}

	return u.repo.FinalizeMatch(ctx, input)
}

var nowUTC = func() time.Time {
	return time.Now().UTC()
}
