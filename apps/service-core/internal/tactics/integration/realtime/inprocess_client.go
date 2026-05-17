package realtime

import (
	"context"

	realtimebroadcaster "fifam/apps/service-core/internal/realtime/broadcaster"
	realtimerooms "fifam/apps/service-core/internal/realtime/rooms"
	"fifam/apps/service-core/internal/tactics/domain"
)

type InProcessClient struct {
	engine *realtimebroadcaster.MatchEngine
}

func NewInProcessClient(engine *realtimebroadcaster.MatchEngine) *InProcessClient {
	return &InProcessClient{engine: engine}
}

func (c *InProcessClient) Push(ctx context.Context, cfg domain.Config) error {
	if c == nil || c.engine == nil {
		return nil
	}

	_ = ctx
	return c.engine.UpdateTeamTactics(realtimebroadcaster.UpdateTacticsInput{
		TeamID:    cfg.TeamID,
		Formation: cfg.Formation,
		PassRatio: cfg.PassRatio,
		ShotRatio: cfg.ShotRatio,
		Pressure:  cfg.Pressure,
		Mode:      cfg.Mode,
		Gameplay: realtimebroadcaster.GameplayTuningInput{
			PassSpeedScale:     cfg.Gameplay.PassSpeedScale,
			InterceptionRadius: cfg.Gameplay.InterceptionRadius,
			GKBuildUpBias:      cfg.Gameplay.GKBuildUpBias,
			TempoScale:         cfg.Gameplay.TempoScale,
		},
		Players: mapPlayers(cfg.Players),
	})
}

func (c *InProcessClient) StartMatch(ctx context.Context, matchID string) error {
	if c == nil || c.engine == nil {
		return nil
	}

	_ = ctx
	return c.engine.StartMatch(matchID)
}

func mapPlayers(input []domain.Player) []realtimerooms.PlayerStatsInput {
	if len(input) == 0 {
		return nil
	}

	out := make([]realtimerooms.PlayerStatsInput, 0, len(input))
	for _, p := range input {
		out = append(out, realtimerooms.PlayerStatsInput{
			CardID:         p.CardID,
			Pace:           p.Pace,
			Passing:        p.Passing,
			LongPass:       p.LongPass,
			Vision:         p.Vision,
			Shooting:       p.Shooting,
			Defending:      p.Defending,
			StandingTackle: p.StandingTackle,
			SlidingTackle:  p.SlidingTackle,
			Mental:         p.Mental,
		})
	}

	return out
}
