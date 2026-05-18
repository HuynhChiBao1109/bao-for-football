package usecase

import (
	"context"
	"errors"
	"strings"

	"fifam/apps/service-core/internal/tactics/domain"
)

type repository interface {
	Save(ctx context.Context, cfg domain.Config) (domain.Config, error)
	LoadRealtimePlayers(ctx context.Context, teamID string) ([]domain.Player, error)
}

type realtimePusher interface {
	Push(ctx context.Context, cfg domain.Config) error
}

type SaveTacticsUseCase struct {
	repo   repository
	pusher realtimePusher
}

var modeProfiles = map[string]domain.Gameplay{
	"ranked": {
		PassSpeedScale:     0.96,
		InterceptionRadius: 0.92,
		GKBuildUpBias:      1.2,
		TempoScale:         0.98,
	},
	"casual": {
		PassSpeedScale:     1.05,
		InterceptionRadius: 1.02,
		GKBuildUpBias:      1.0,
		TempoScale:         1.05,
	},
	"ai_campaign": {
		PassSpeedScale:     0.92,
		InterceptionRadius: 1.12,
		GKBuildUpBias:      1.1,
		TempoScale:         0.94,
	},
}

func NewSaveTacticsUseCase(repo repository, pusher realtimePusher) *SaveTacticsUseCase {
	return &SaveTacticsUseCase{repo: repo, pusher: pusher}
}

func (u *SaveTacticsUseCase) Execute(ctx context.Context, cfg domain.Config) (domain.Config, error) {
	teamID, err := normalizeTeamID(cfg.TeamID)
	if err != nil {
		return domain.Config{}, err
	}

	cfg.TeamID = teamID
	cfg.Formation = strings.TrimSpace(cfg.Formation)

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

	mode := strings.ToLower(strings.TrimSpace(cfg.Mode))
	if mode == "" {
		mode = "casual"
	}

	profile, ok := modeProfiles[mode]
	if !ok {
		return domain.Config{}, errors.New("mode must be ranked, casual, or ai_campaign")
	}

	if cfg.Gameplay.PassSpeedScale != 0 && (cfg.Gameplay.PassSpeedScale < 0.65 || cfg.Gameplay.PassSpeedScale > 1.45) {
		return domain.Config{}, errors.New("gameplay.passSpeedScale must be between 0.65 and 1.45")
	}
	if cfg.Gameplay.InterceptionRadius != 0 && (cfg.Gameplay.InterceptionRadius < 0.55 || cfg.Gameplay.InterceptionRadius > 1.6) {
		return domain.Config{}, errors.New("gameplay.interceptionRadius must be between 0.55 and 1.6")
	}
	if cfg.Gameplay.GKBuildUpBias != 0 && (cfg.Gameplay.GKBuildUpBias < 0.5 || cfg.Gameplay.GKBuildUpBias > 2.0) {
		return domain.Config{}, errors.New("gameplay.gkBuildUpBias must be between 0.5 and 2.0")
	}
	if cfg.Gameplay.TempoScale != 0 && (cfg.Gameplay.TempoScale < 0.75 || cfg.Gameplay.TempoScale > 1.4) {
		return domain.Config{}, errors.New("gameplay.tempoScale must be between 0.75 and 1.4")
	}

	if cfg.Gameplay.PassSpeedScale != 0 {
		profile.PassSpeedScale = cfg.Gameplay.PassSpeedScale
	}
	if cfg.Gameplay.InterceptionRadius != 0 {
		profile.InterceptionRadius = cfg.Gameplay.InterceptionRadius
	}
	if cfg.Gameplay.GKBuildUpBias != 0 {
		profile.GKBuildUpBias = cfg.Gameplay.GKBuildUpBias
	}
	if cfg.Gameplay.TempoScale != 0 {
		profile.TempoScale = cfg.Gameplay.TempoScale
	}

	lineup := make([]domain.LineupSlot, 0, len(cfg.Lineup))
	for _, item := range cfg.Lineup {
		slotID := strings.ToLower(strings.TrimSpace(item.SlotID))
		position := strings.ToUpper(strings.TrimSpace(item.Position))
		if slotID == "" || position == "" {
			continue
		}
		lineup = append(lineup, domain.LineupSlot{
			SlotID:       slotID,
			Position:     position,
			UserPlayerID: item.UserPlayerID,
		})
	}

	normalized := domain.Config{
		TeamID:    cfg.TeamID,
		Formation: cfg.Formation,
		PassRatio: cfg.PassRatio / 100.0,
		ShotRatio: cfg.ShotRatio / 100.0,
		Pressure:  cfg.Pressure / 100.0,
		Mode:      mode,
		Gameplay:  profile,
		Lineup:    lineup,
	}

	players, err := u.repo.LoadRealtimePlayers(ctx, cfg.TeamID)
	if err != nil {
		return domain.Config{}, err
	}
	normalized.Players = players

	saved, err := u.repo.Save(ctx, normalized)
	if err != nil {
		return domain.Config{}, err
	}

	if err := u.pusher.Push(ctx, saved); err != nil {
		return domain.Config{}, err
	}

	return saved, nil
}
