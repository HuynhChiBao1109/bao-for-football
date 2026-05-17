package rooms

import "time"

type Vec2 struct {
	X float64
	Y float64
}

type Player struct {
	ID             int
	TeamID         string
	Role           string
	X              float64
	Y              float64
	HomeX          float64
	HomeY          float64
	Pace           int
	Passing        int
	LongPass       int
	Vision         int
	Shooting       int
	Defending      int
	StandingTackle int
	SlidingTackle  int
	Mental         int
	HasBall        bool
}

type PlayerStatsInput struct {
	CardID         uint64
	Pace           int
	Passing        int
	LongPass       int
	Vision         int
	Shooting       int
	Defending      int
	StandingTackle int
	SlidingTackle  int
	Mental         int
}

type TeamTactics struct {
	Formation string
	PassRatio float64
	ShotRatio float64
	Pressure  float64
	Pressing  float64
	Mental    float64
}

type Team struct {
	ID        string
	Name      string
	AttackDir float64
	Score     int
	Tactics   TeamTactics
	Players   []*Player
}

type Ball struct {
	X           float64
	Y           float64
	VX          float64
	VY          float64
	Height      float64
	OwnerTeamID string
	OwnerID     int
	InFlight    bool
	IsLob       bool
	PassTeamID  string
	TargetID    int
	TargetX     float64
	TargetY     float64
	FlightTotal float64
	FlightLeft  float64
}

type MatchState struct {
	MatchID   string
	Duration  time.Duration
	Elapsed   time.Duration
	FieldW    float64
	FieldH    float64
	HomeTeam  *Team
	AwayTeam  *Team
	Ball      Ball
	StartedAt time.Time
}

func (m *MatchState) AllPlayers() []*Player {
	players := make([]*Player, 0, len(m.HomeTeam.Players)+len(m.AwayTeam.Players))
	players = append(players, m.HomeTeam.Players...)
	players = append(players, m.AwayTeam.Players...)
	return players
}

func NewDemoMatchState(matchID string) *MatchState {
	fieldW := 100.0
	fieldH := 64.0
	if matchID == "" {
		matchID = "match-demo-11v11"
	}

	home := &Team{
		ID:        "home",
		Name:      "FC Navy",
		AttackDir: 1,
		Tactics: TeamTactics{
			Formation: "4-3-3",
			PassRatio: 0.52,
			ShotRatio: 0.48,
			Pressure:  0.68,
			Pressing:  0.68,
			Mental:    0.72,
		},
	}

	away := &Team{
		ID:        "away",
		Name:      "Black United",
		AttackDir: -1,
		Tactics: TeamTactics{
			Formation: "4-3-3",
			PassRatio: 0.51,
			ShotRatio: 0.49,
			Pressure:  0.64,
			Pressing:  0.64,
			Mental:    0.69,
		},
	}

	home.Players = createTeamPlayers(home.ID, false)
	away.Players = createTeamPlayers(away.ID, true)

	state := &MatchState{
		MatchID:   matchID,
		Duration:  2 * time.Minute,
		Elapsed:   0,
		FieldW:    fieldW,
		FieldH:    fieldH,
		HomeTeam:  home,
		AwayTeam:  away,
		StartedAt: time.Now(),
	}

	state.Ball = Ball{
		X:           fieldW / 2,
		Y:           fieldH / 2,
		OwnerTeamID: home.ID,
		OwnerID:     home.Players[9].ID,
	}
	home.Players[9].HasBall = true

	return state
}

func createTeamPlayers(teamID string, mirror bool) []*Player {
	homeShape := []Vec2{
		{6, 32},
		{20, 10}, {20, 24}, {20, 40}, {20, 54},
		{38, 16}, {38, 32}, {38, 48},
		{58, 14}, {58, 32}, {58, 50},
	}

	roles := []string{"GK", "LB", "LCB", "RCB", "RB", "LCM", "CM", "RCM", "LW", "ST", "RW"}

	players := make([]*Player, 0, 11)
	baseID := 1
	if mirror {
		baseID = 12
	}

	for i := 0; i < 11; i++ {
		x := homeShape[i].X
		y := homeShape[i].Y
		if mirror {
			x = 100 - x
		}

		pace := 62 + (i*3)%28
		passing := 60 + (i*4)%26
		longPass := 56 + (i*5)%30
		vision := 58 + (i*4+7)%30
		shooting := 58 + (i*5)%30
		defending := 57 + (i*6)%33
		standingTackle := 56 + (i*5+3)%31
		slidingTackle := 55 + (i*4+9)%32
		mental := 60 + (i*2)%24

		if roles[i] == "GK" {
			longPass += 8
			vision -= 4
		}
		if roles[i] == "CM" || roles[i] == "LCM" || roles[i] == "RCM" {
			vision += 8
			passing += 5
		}
		if roles[i] == "ST" {
			vision += 4
			passing -= 3
		}

		passing = clampInt(passing, 45, 95)
		longPass = clampInt(longPass, 40, 95)
		vision = clampInt(vision, 40, 95)

		players = append(players, &Player{
			ID:             baseID + i,
			TeamID:         teamID,
			Role:           roles[i],
			X:              x,
			Y:              y,
			HomeX:          x,
			HomeY:          y,
			Pace:           pace,
			Passing:        passing,
			LongPass:       longPass,
			Vision:         vision,
			Shooting:       shooting,
			Defending:      defending,
			StandingTackle: standingTackle,
			SlidingTackle:  slidingTackle,
			Mental:         mental,
		})
	}

	return players
}

func ApplyFormation(team *Team, formation string) {
	shape := formationShape(formation)
	if len(shape) != 11 {
		return
	}

	team.Tactics.Formation = formation

	for idx, p := range team.Players {
		x := shape[idx].X
		y := shape[idx].Y
		if team.AttackDir < 0 {
			x = 100 - x
		}

		p.HomeX = x
		p.HomeY = y
	}
}

func ApplyPlayerStats(team *Team, incoming []PlayerStatsInput) {
	if len(incoming) == 0 {
		return
	}

	limit := len(team.Players)
	if len(incoming) < limit {
		limit = len(incoming)
	}

	for i := 0; i < limit; i++ {
		src := incoming[i]
		dst := team.Players[i]

		dst.Pace = clampInt(src.Pace, 35, 99)
		dst.Passing = clampInt(src.Passing, 35, 99)
		dst.LongPass = clampInt(src.LongPass, 35, 99)
		dst.Vision = clampInt(src.Vision, 35, 99)
		dst.Shooting = clampInt(src.Shooting, 35, 99)
		dst.Defending = clampInt(src.Defending, 35, 99)
		dst.StandingTackle = clampInt(src.StandingTackle, 35, 99)
		dst.SlidingTackle = clampInt(src.SlidingTackle, 35, 99)
		dst.Mental = clampInt(src.Mental, 35, 99)
	}
}

func formationShape(formation string) []Vec2 {
	switch formation {
	case "4-4-2":
		return []Vec2{
			{6, 32},
			{20, 10}, {20, 24}, {20, 40}, {20, 54},
			{38, 10}, {38, 24}, {38, 40}, {38, 54},
			{58, 24}, {58, 40},
		}
	case "4-3-3":
		fallthrough
	default:
		return []Vec2{
			{6, 32},
			{20, 10}, {20, 24}, {20, 40}, {20, 54},
			{38, 16}, {38, 32}, {38, 48},
			{58, 14}, {58, 32}, {58, 50},
		}
	}
}

func clampInt(v int, minV int, maxV int) int {
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}
