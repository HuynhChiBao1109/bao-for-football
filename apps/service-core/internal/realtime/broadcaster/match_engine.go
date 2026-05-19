package broadcaster

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"

	"fifam/apps/service-core/internal/realtime/events"
	"fifam/apps/service-core/internal/realtime/hub"
	"fifam/apps/service-core/internal/realtime/rooms"
)

const (
	tickInterval          = 100 * time.Millisecond
	preKickoffWarmupTicks = 7
	matchLength           = 2 * time.Minute
	gkHomeMinX            = 2.0
	gkHomeMaxX            = 15.0
	gkAwayMinX            = 85.0
	gkAwayMaxX            = 98.0
)

type gameplayRuntime struct {
	Mode               string
	PassSpeedScale     float64
	InterceptionRadius float64
	GKBuildUpBias      float64
	TempoScale         float64
}

type GameplayTuningInput struct {
	PassSpeedScale     float64
	InterceptionRadius float64
	GKBuildUpBias      float64
	TempoScale         float64
}

type passDecision struct {
	target       *rooms.Player
	isLob        bool
	success      float64
	targetX      float64
	targetY      float64
	initialSpeed float64
}

type kickoffPassState struct {
	teamID     string
	passerID   int
	receiverID int
	delayTicks int
}

type celebrationState struct {
	scorerID      int
	teamID        string
	kickoffTeamID string
	ticksLeft     int
	cornerX       float64
	cornerY       float64
}

type substitutionState struct {
	teamID       string
	playerOutID  int
	playerInID   int
	outX         float64
	outY         float64
	outReached   bool
	ticksLeft    int
	hasHighFived bool
	playerInObj  *rooms.Player // temporary player model to render inside the sub animation
}

type setPieceType string

const (
	setPieceFarFreeKick  setPieceType = "far_free_kick"
	setPieceNearFreeKick setPieceType = "near_free_kick"
	setPiecePenalty      setPieceType = "penalty"
)

type setPieceState struct {
	Type          setPieceType
	TeamID        string        // attacking team
	DefTeamID     string        // defending team
	FoulX         float64       // coordinates of the foul / spot
	FoulY         float64       // coordinates of the foul / spot
	KickerID      int           // designated kicker player ID
	KickerObj     *rooms.Player // designated kicker player
	GKObj         *rooms.Player // defending goalkeeper
	TicksLeft     int           // dynamic delay before execution
	Initialized   bool          // whether wall/positions are set up
	Executed      bool          // whether kick is shot/passed
}

type MatchEngine struct {
	hub          *hub.Hub
	rand         *rand.Rand
	mu           sync.Mutex
	running      bool
	stopCh       chan struct{}
	state        *rooms.MatchState
	kickoff      *kickoffPassState
	celebration  *celebrationState
	substitution *substitutionState
	setPiece     *setPieceState
	pending      map[string]UpdateTacticsInput
	bindings     map[string]string
	runtime      gameplayRuntime
	eventQueue   []events.MatchEvent
	momentum     float64
}

type UpdateTacticsInput struct {
	TeamID    string
	Formation string
	PassRatio float64
	ShotRatio float64
	Pressure  float64
	Mode      string
	Gameplay  GameplayTuningInput
	Players   []rooms.PlayerStatsInput
}

func NewMatchEngine(h *hub.Hub) *MatchEngine {
	return &MatchEngine{
		hub:      h,
		rand:     rand.New(rand.NewSource(time.Now().UnixNano())),
		pending:  make(map[string]UpdateTacticsInput),
		bindings: make(map[string]string),
		runtime:  runtimeFromInput("casual", GameplayTuningInput{}),
	}
}

func (e *MatchEngine) EnsureRunning() {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return
	}
	stopCh := make(chan struct{})
	e.running = true
	e.stopCh = stopCh
	e.mu.Unlock()

	go e.run("match-demo-11v11", "", "", stopCh)
}

func (e *MatchEngine) StartMatch(matchID string, homeName string, awayName string) error {
	e.mu.Lock()
	matchID = strings.TrimSpace(matchID)
	if matchID == "" {
		e.mu.Unlock()
		return fmt.Errorf("matchId is required")
	}

	if e.running {
		if e.stopCh != nil {
			close(e.stopCh)
		}
	}

	stopCh := make(chan struct{})
	e.running = true
	e.stopCh = stopCh
	e.mu.Unlock()

	go e.run(matchID, homeName, awayName, stopCh)
	return nil
}

func (e *MatchEngine) run(matchID string, homeName string, awayName string, stopCh chan struct{}) {
	state := rooms.NewDemoMatchState(matchID)
	homeName = strings.TrimSpace(homeName)
	if homeName != "" {
		state.HomeTeam.Name = homeName
	}
	awayName = strings.TrimSpace(awayName)
	if awayName != "" {
		state.AwayTeam.Name = awayName
	}
	state.Duration = matchLength
	startingKickoffTeamID := state.HomeTeam.ID

	e.mu.Lock()
	e.state = state
	for externalTeamID, input := range e.pending {
		internalTeamID, err := e.resolveInternalTeamIDLocked(externalTeamID)
		if err != nil {
			continue
		}
		e.applyTacticsLocked(input, internalTeamID)
	}
	e.mu.Unlock()

	// First emit a neutral snapshot so UI can fully mount before kickoff events begin.
	e.broadcastTick(state, 0, nil)

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	tick := 0
	kickoffWarmupTicks := preKickoffWarmupTicks
	halfTimeAnnounced := false
	halfTimeHoldTicks := 0
	secondHalfKickoffDelayTicks := 0
	secondHalfKickoffTeamID := state.AwayTeam.ID
	stopped := false

	for {
		select {
		case <-stopCh:
			stopped = true
			goto cleanup
		case <-ticker.C:
		}

		tick++
		e.mu.Lock()

		if kickoffWarmupTicks > 0 {
			kickoffWarmupTicks--
			e.computePlayerMovement(state, nil)
			if kickoffWarmupTicks == 0 {
				tickEvents := e.prepareKickoffSequence(state, startingKickoffTeamID, "Match started")
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if halfTimeHoldTicks > 0 {
			halfTimeHoldTicks--
			e.computePlayerMovement(state, nil)
			if halfTimeHoldTicks == 0 {
				secondHalfKickoffDelayTicks = 8
				tickEvents := []events.MatchEvent{{Kind: "second_half_start", Message: "Second half started"}}
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if secondHalfKickoffDelayTicks > 0 {
			secondHalfKickoffDelayTicks--
			e.computePlayerMovement(state, nil)
			if secondHalfKickoffDelayTicks == 0 {
				tickEvents := e.prepareKickoffSequence(state, secondHalfKickoffTeamID, "Second half kickoff")
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if e.celebration != nil {
			e.celebration.ticksLeft--
			e.computePlayerMovement(state, nil)
			if e.celebration.ticksLeft <= 0 {
				kickoffTeamID := e.celebration.kickoffTeamID
				e.celebration = nil
				tickEvents := e.prepareKickoffSequence(state, kickoffTeamID, "Kickoff after goal celebration")
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if e.substitution != nil {
			e.substitution.ticksLeft--
			e.updateSubstitutionTick(state)
			if e.substitution.ticksLeft <= 0 {
				e.finalizeSubstitution(state)
				e.broadcastTick(state, tick, []events.MatchEvent{{Kind: "substitution_done", Message: "Substitution done"}})
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if e.kickoff != nil {
			e.kickoff.delayTicks--
			e.computePlayerMovement(state, nil)
			if e.kickoff.delayTicks <= 0 {
				tickEvents := e.executeKickoffPass(state)
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if e.setPiece != nil {
			e.setPiece.TicksLeft--
			e.updateSetPieceTick(state)
			if e.setPiece.TicksLeft <= 0 && !e.setPiece.Executed {
				tickEvents := e.executeSetPiece(state)
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		state.Elapsed += tickInterval
		if !halfTimeAnnounced && state.Elapsed >= matchLength/2 {
			halfTimeAnnounced = true
			halfTimeHoldTicks = 18
			e.broadcastTick(state, tick, []events.MatchEvent{{Kind: "half_time", Message: "Half time"}})
			e.mu.Unlock()
			continue
		}

		tickEvents := e.updateState(state)
		e.broadcastTick(state, tick, tickEvents)
		e.mu.Unlock()

		if state.Elapsed >= matchLength {
			break
		}
	}

cleanup:
	if !stopped {
		endEvent := events.MatchEvent{
			Kind:    "match_end",
			Message: fmt.Sprintf("FT %s %d-%d %s", state.HomeTeam.Name, state.HomeTeam.Score, state.AwayTeam.Score, state.AwayTeam.Name),
		}
		e.broadcastTick(state, tick, []events.MatchEvent{endEvent})
	}

	e.mu.Lock()
	if e.stopCh == stopCh {
		e.running = false
		e.state = nil
		e.kickoff = nil
		e.stopCh = nil
	}
	e.mu.Unlock()
}

func (e *MatchEngine) UpdateTeamTactics(input UpdateTacticsInput) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	input.TeamID = strings.ToLower(strings.TrimSpace(input.TeamID))
	if input.TeamID == "" {
		return fmt.Errorf("teamId is required")
	}
	if input.Formation != "4-3-3" && input.Formation != "4-4-2" && input.Formation != "3-5-2" && input.Formation != "4-2-3-1" {
		return fmt.Errorf("invalid formation")
	}
	if input.PassRatio < 0 || input.PassRatio > 1 {
		return fmt.Errorf("passRatio must be between 0 and 1")
	}
	if input.ShotRatio < 0 || input.ShotRatio > 1 {
		return fmt.Errorf("shotRatio must be between 0 and 1")
	}
	if input.Pressure < 0 || input.Pressure > 1 {
		return fmt.Errorf("pressure must be between 0 and 1")
	}
	if input.Gameplay.PassSpeedScale != 0 && (input.Gameplay.PassSpeedScale < 0.65 || input.Gameplay.PassSpeedScale > 1.45) {
		return fmt.Errorf("gameplay.passSpeedScale must be between 0.65 and 1.45")
	}
	if input.Gameplay.InterceptionRadius != 0 && (input.Gameplay.InterceptionRadius < 0.55 || input.Gameplay.InterceptionRadius > 1.6) {
		return fmt.Errorf("gameplay.interceptionRadius must be between 0.55 and 1.6")
	}
	if input.Gameplay.GKBuildUpBias != 0 && (input.Gameplay.GKBuildUpBias < 0.5 || input.Gameplay.GKBuildUpBias > 2.0) {
		return fmt.Errorf("gameplay.gkBuildUpBias must be between 0.5 and 2.0")
	}
	if input.Gameplay.TempoScale != 0 && (input.Gameplay.TempoScale < 0.75 || input.Gameplay.TempoScale > 1.4) {
		return fmt.Errorf("gameplay.tempoScale must be between 0.75 and 1.4")
	}

	internalTeamID, err := e.resolveInternalTeamIDLocked(input.TeamID)
	if err != nil {
		return err
	}

	e.pending[input.TeamID] = input

	if e.state == nil {
		return nil
	}

	e.applyTacticsLocked(input, internalTeamID)

	return nil
}

func (e *MatchEngine) applyTacticsLocked(input UpdateTacticsInput, internalTeamID string) {
	team := e.state.HomeTeam
	if internalTeamID == e.state.AwayTeam.ID {
		team = e.state.AwayTeam
	}

	team.Tactics.PassRatio = clamp(input.PassRatio, 0, 1)
	team.Tactics.ShotRatio = clamp(input.ShotRatio, 0, 1)
	team.Tactics.Pressure = clamp(input.Pressure, 0, 1)
	team.Tactics.Pressing = team.Tactics.Pressure
	team.Tactics.Mental = clamp(0.45+team.Tactics.ShotRatio*0.2+team.Tactics.PassRatio*0.2, 0.45, 0.9)
	rooms.ApplyFormation(team, input.Formation)
	rooms.ApplyPlayerStats(team, input.Players)
	e.runtime = runtimeFromInput(input.Mode, input.Gameplay)
}

func (e *MatchEngine) RequestSubstitution(teamID string, playerOutID int, playerInID int) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.state == nil {
		return fmt.Errorf("no active match running")
	}

	team := e.state.HomeTeam
	if teamID == "away" || teamID == e.state.AwayTeam.ID {
		team = e.state.AwayTeam
	}

	// 1. Find playerOut in active roster
	var outIdx = -1
	for idx, p := range team.Players {
		if p.ID == playerOutID {
			outIdx = idx
			break
		}
	}
	if outIdx == -1 {
		return fmt.Errorf("active player not found in roster")
	}

	// 2. Find playerIn in reserves
	var inIdx = -1
	for idx, p := range team.Reserves {
		if p.ID == playerInID {
			inIdx = idx
			break
		}
	}
	if inIdx == -1 {
		return fmt.Errorf("reserve player not found in reserves")
	}

	// Check if already in substitution phase
	if e.substitution != nil {
		return fmt.Errorf("a substitution is already in progress")
	}

	playerOut := team.Players[outIdx]
	playerIn := team.Reserves[inIdx]

	// Put playerIn in a temporary rendering model starting off pitch near midfield touchline
	playerInCopy := &rooms.Player{
		ID:             playerIn.ID,
		TeamID:         playerIn.TeamID,
		Role:           playerOut.Role, // inherits position/role
		Name:           playerIn.Name,
		Avatar:         playerIn.Avatar,
		X:              50.0,
		Y:              -2.5,
		HomeX:          playerOut.HomeX,
		HomeY:          playerOut.HomeY,
		Pace:           playerIn.Pace,
		Passing:        playerIn.Passing,
		LongPass:       playerIn.LongPass,
		Vision:         playerIn.Vision,
		Shooting:       playerIn.Shooting,
		Defending:      playerIn.Defending,
		StandingTackle: playerIn.StandingTackle,
		SlidingTackle:  playerIn.SlidingTackle,
		Mental:         playerIn.Mental,
		Morale:         playerIn.Morale,
		Fatigue:        0.0, // fresh stamina
	}

	e.substitution = &substitutionState{
		teamID:       team.ID,
		playerOutID:  playerOut.ID,
		playerInID:   playerIn.ID,
		outX:         50.0,
		outY:         1.2,
		outReached:   false,
		ticksLeft:    90, // ~9 seconds duration
		playerInObj:  playerInCopy,
	}

	// Log prepared event
	e.eventQueue = append(e.eventQueue, events.MatchEvent{
		Kind:     "substitution_prepared",
		TeamID:   team.ID,
		PlayerID: playerOut.ID,
		Message:  fmt.Sprintf("🔄 Bảng thay người: %s (%s) chuẩn bị rời sân, %s vào sân!", playerOut.Name, playerOut.Role, playerIn.Name),
	})

	return nil
}

func runtimeFromInput(mode string, tuning GameplayTuningInput) gameplayRuntime {
	normalizedMode := strings.ToLower(strings.TrimSpace(mode))
	if normalizedMode == "" {
		normalizedMode = "casual"
	}

	base := gameplayRuntime{
		Mode:               normalizedMode,
		PassSpeedScale:     1.05,
		InterceptionRadius: 1.02,
		GKBuildUpBias:      1.0,
		TempoScale:         1.05,
	}

	switch normalizedMode {
	case "ranked":
		base.PassSpeedScale = 0.96
		base.InterceptionRadius = 0.92
		base.GKBuildUpBias = 1.2
		base.TempoScale = 0.98
	case "ai_campaign":
		base.PassSpeedScale = 0.92
		base.InterceptionRadius = 1.12
		base.GKBuildUpBias = 1.1
		base.TempoScale = 0.94
	}

	if tuning.PassSpeedScale != 0 {
		base.PassSpeedScale = tuning.PassSpeedScale
	}
	if tuning.InterceptionRadius != 0 {
		base.InterceptionRadius = tuning.InterceptionRadius
	}
	if tuning.GKBuildUpBias != 0 {
		base.GKBuildUpBias = tuning.GKBuildUpBias
	}
	if tuning.TempoScale != 0 {
		base.TempoScale = tuning.TempoScale
	}

	return base
}

func (e *MatchEngine) resolveInternalTeamIDLocked(externalTeamID string) (string, error) {
	if externalTeamID == "" {
		return "", fmt.Errorf("teamId is required")
	}

	if externalTeamID == "home" || externalTeamID == "away" {
		e.bindings[externalTeamID] = externalTeamID
		return externalTeamID, nil
	}

	if mapped, ok := e.bindings[externalTeamID]; ok {
		return mapped, nil
	}

	usedHome := false
	usedAway := false
	for _, slot := range e.bindings {
		if slot == "home" {
			usedHome = true
		}
		if slot == "away" {
			usedAway = true
		}
	}

	if !usedHome {
		e.bindings[externalTeamID] = "home"
		return "home", nil
	}

	if !usedAway {
		e.bindings[externalTeamID] = "away"
		return "away", nil
	}

	return "", fmt.Errorf("match already has 2 tactic team bindings")
}

func (e *MatchEngine) queueEvent(event events.MatchEvent) {
	e.eventQueue = append(e.eventQueue, event)
}

func (e *MatchEngine) getPriority(kind string) int {
	switch kind {
	case "goal", "red_card", "penalty_awarded", "penalty_scored", "penalty_missed", "own_goal", "var":
		return 5
	case "yellow_card", "foul", "free_kick", "corner", "great_save", "woodwork_hit", "injury", "match_end", "kickoff":
		return 4
	case "shot", "save", "blocked_shot", "clearance", "tackle", "sliding_tackle", "substitution":
		return 3
	case "through_ball", "cross", "long_pass", "nutmeg", "skill_move", "dribble_success", "counter_attack", "momentum_shift", "big_chance":
		return 2
	default:
		return 1
	}
}

func (e *MatchEngine) processQueue() []events.MatchEvent {
	if len(e.eventQueue) == 0 {
		return nil
	}

	// Sort by priority descending
	for i := 0; i < len(e.eventQueue); i++ {
		for j := i + 1; j < len(e.eventQueue); j++ {
			if e.getPriority(e.eventQueue[j].Kind) > e.getPriority(e.eventQueue[i].Kind) {
				e.eventQueue[i], e.eventQueue[j] = e.eventQueue[j], e.eventQueue[i]
			}
		}
	}

	// Emit at most 2 events per tick to space out popping transitions
	limit := 2
	if len(e.eventQueue) < limit {
		limit = len(e.eventQueue)
	}

	emitted := e.eventQueue[:limit]
	e.eventQueue = e.eventQueue[limit:]
	return emitted
}

func (e *MatchEngine) getOffsideLine(state *rooms.MatchState, defendingTeamID string) float64 {
	opponents := state.HomeTeam.Players
	if defendingTeamID == state.AwayTeam.ID {
		opponents = state.AwayTeam.Players
	}

	var deepestX = 0.0
	var secondDeepestX = 0.0
	isHome := defendingTeamID == "home"

	if isHome {
		deepestX = 999.0
		secondDeepestX = 999.0
		for _, p := range opponents {
			if p.Role == "GK" {
				continue
			}
			if p.X < deepestX {
				secondDeepestX = deepestX
				deepestX = p.X
			} else if p.X < secondDeepestX {
				secondDeepestX = p.X
			}
		}
		if secondDeepestX > 500 {
			secondDeepestX = 22.0
		}
		return clamp(secondDeepestX, 16.5, 50.0)
	} else {
		deepestX = -999.0
		secondDeepestX = -999.0
		for _, p := range opponents {
			if p.Role == "GK" {
				continue
			}
			if p.X > deepestX {
				secondDeepestX = deepestX
				deepestX = p.X
			} else if p.X > secondDeepestX {
				secondDeepestX = p.X
			}
		}
		if secondDeepestX < -500 {
			secondDeepestX = state.FieldW - 22.0
		}
		return clamp(secondDeepestX, 50.0, state.FieldW-16.5)
	}
}

func (e *MatchEngine) predictBallIntercept(state *rooms.MatchState, p *rooms.Player) (float64, float64) {
	if state.Ball.InFlight {
		return state.Ball.TargetX, state.Ball.TargetY
	}
	predX := state.Ball.X + state.Ball.VX*1.8
	predY := state.Ball.Y + state.Ball.VY*1.8
	return clamp(predX, 0, state.FieldW), clamp(predY, 0, state.FieldH)
}

func (e *MatchEngine) computePlayerMovement(state *rooms.MatchState, tickEvents *[]events.MatchEvent) {
	homeNearest := nearestToBall(state.HomeTeam.Players, state.Ball.X, state.Ball.Y)
	awayNearest := nearestToBall(state.AwayTeam.Players, state.Ball.X, state.Ball.Y)
	ballOwner := findPlayerByID(state.AllPlayers(), state.Ball.OwnerID)
	hasPossessor := ballOwner != nil

	// Determine active attacking possession even if the ball is in flight
	attackingTeamID := ""
	if hasPossessor {
		attackingTeamID = ballOwner.TeamID
	} else if state.Ball.PassTeamID != "" {
		attackingTeamID = state.Ball.PassTeamID
	}
	hasAttackingPossession := attackingTeamID != ""

	for _, p := range state.AllPlayers() {
		if e.celebration != nil {
			var targetX, targetY float64
			if p.Role == "GK" {
				targetX = p.HomeX
				targetY = p.HomeY
			} else if p.TeamID == e.celebration.teamID {
				// Scoring team celebrates!
				if p.ID == e.celebration.scorerID {
					// Scorer runs to the corner flag to celebrate
					targetX = e.celebration.cornerX
					targetY = e.celebration.cornerY
				} else {
					// Teammates run to the scorer to celebrate together!
					scorer := findPlayerByID(state.AllPlayers(), e.celebration.scorerID)
					if scorer != nil {
						offsetAngle := float64(p.ID) * 0.72
						targetX = scorer.X + math.Cos(offsetAngle)*1.8
						targetY = scorer.Y + math.Sin(offsetAngle)*1.8
					} else {
						targetX = e.celebration.cornerX
						targetY = e.celebration.cornerY
					}
				}
			} else {
				// Defending team is dejected and walks slowly back to their home penalty area
				targetX = p.HomeX * 0.8 + (state.FieldW/2) * 0.2
				targetY = p.HomeY * 0.8 + (state.FieldH/2) * 0.2
			}
			
			dx := targetX - p.X
			dy := targetY - p.Y
			dist := math.Sqrt(dx*dx + dy*dy)
			desiredVX := 0.0
			desiredVY := 0.0
			if dist > 0.1 {
				// Dejected defenders walk slow, celebrating team runs fast
				speedScale := 1.15
				if p.TeamID != e.celebration.teamID {
					speedScale = 0.38
				}
				maxStep := e.paceStep(p.Pace) * speedScale
				desiredVX = dx / dist * maxStep
				desiredVY = dy / dist * maxStep
			}
			turnRate := 0.28 + float64(p.Mental)*0.0018
			p.VX += (desiredVX - p.VX) * turnRate
			p.VY += (desiredVY - p.VY) * turnRate
			p.X += p.VX
			p.Y += p.VY
			p.X = clamp(p.X, 1.2, state.FieldW-1.2)
			p.Y = clamp(p.Y, 1.2, state.FieldH-1.2)
			
			if p.Role == "GK" {
				p.X, p.Y = clampGoalkeeperPosition(p, state)
			}
			continue
		}

		if p.Morale <= 0.0 {
			p.Morale = 1.0
		}

		opponents := state.AwayTeam.Players
		if p.TeamID == state.AwayTeam.ID {
			opponents = state.HomeTeam.Players
		}
		nearestOppDist := nearestOpponentDistance(p, opponents)
		if nearestOppDist < 5.0 {
			p.Pressure = clamp((5.0-nearestOppDist)/5.0, 0, 1)
		} else {
			p.Pressure = 0
		}

		targetX, targetY := p.HomeX, p.HomeY
		team := state.HomeTeam
		oppTeam := state.AwayTeam
		if p.TeamID == state.AwayTeam.ID {
			team = state.AwayTeam
			oppTeam = state.HomeTeam
		}

		isPossessor := hasPossessor && ballOwner.ID == p.ID
		sameTeamAsAttacker := hasAttackingPossession && attackingTeamID == p.TeamID
		isNearestChaser := (homeNearest != nil && p.ID == homeNearest.ID) || (awayNearest != nil && p.ID == awayNearest.ID)

		widthScale := 1.0
		if sameTeamAsAttacker {
			widthScale = 1.12 + team.Tactics.PassRatio*0.25
		} else if hasAttackingPossession {
			widthScale = 0.82 - team.Tactics.Pressure*0.12
		}

		centerH := state.FieldH / 2
		targetY = centerH + (targetY-centerH)*widthScale

		lineShift := 0.0
		if sameTeamAsAttacker {
			lineShift = team.AttackDir * (12.0 + team.Tactics.ShotRatio*11.0)
		} else if hasAttackingPossession {
			lineShift = team.AttackDir * (-9.0 + team.Tactics.Pressure*15.0)
		}

		if p.Role != "GK" {
			targetX = clamp(targetX+lineShift, 8, state.FieldW-8)
		}

		// Attacking off-ball support runs seeking open spaces and clear passing lanes (chạy chỗ tìm khoảng trống)
		if sameTeamAsAttacker && !isPossessor && p.Role != "GK" {
			// 1. Start with the base tactical target position
			baseTargetX, baseTargetY := targetX, targetY
			if (p.Role == "LB" || p.Role == "RB") && state.Ball.X > 35 {
				baseTargetX = clamp(state.Ball.X+team.AttackDir*15.0, 15, state.FieldW-12)
				baseTargetY = p.HomeY
				if tickEvents != nil && e.rand.Float64() < 0.015 && distance(p.X, p.Y, state.Ball.X, state.Ball.Y) < 18 {
					*tickEvents = append(*tickEvents, events.MatchEvent{
						Kind:     "overload",
						TeamID:   p.TeamID,
						PlayerID: p.ID,
						Message:  fmt.Sprintf("%s overlaps aggressively", p.Role),
					})
				}
			} else if p.Role == "LW" || p.Role == "RW" || p.Role == "ST" || p.Role == "LST" || p.Role == "RST" {
				baseTargetX = clamp(state.Ball.X+team.AttackDir*(14.0+float64(p.Pace)*0.10), 12, state.FieldW-3)
				if p.Role == "LW" {
					baseTargetY = clamp(state.Ball.Y-10.0, 3, state.FieldH-3)
				} else if p.Role == "RW" {
					baseTargetY = clamp(state.Ball.Y+10.0, 3, state.FieldH-3)
				} else {
					baseTargetY = clamp(state.FieldH/2+(e.rand.Float64()-0.5)*14, 10, state.FieldH-10)
				}
				
				// Clamp behind the offside line
				lastDefenderX := e.getOffsideLine(state, oppTeam.ID)
				if team.AttackDir > 0 {
					if baseTargetX >= lastDefenderX {
						baseTargetX = lastDefenderX - 1.1
					}
				} else {
					if baseTargetX <= lastDefenderX {
						baseTargetX = lastDefenderX + 1.1
					}
				}
			} else if strings.Contains(p.Role, "CM") || strings.Contains(p.Role, "DM") || strings.Contains(p.Role, "AM") {
				baseTargetX = clamp(state.Ball.X-team.AttackDir*6.0, 18, state.FieldW-18)
				baseTargetY = p.HomeY + (state.Ball.Y-p.HomeY)*0.45
			}

			// 2. Active off-ball adjustment to find maximum local space!
			// Check 5 radial candidate points around the tactical target.
			// Select the candidate point that maximizes space from the closest opponent and has a clear passing lane.
			bestX, bestY := baseTargetX, baseTargetY
			maxScore := -999.0
			
			// Base candidate (doing nothing)
			baseSpace := nearestOpponentDistanceVec(baseTargetX, baseTargetY, oppTeam.Players)
			baseLaneThreat := passingLaneRiskFromCoord(state.Ball.X, state.Ball.Y, baseTargetX, baseTargetY, oppTeam.Players)
			maxScore = baseSpace - baseLaneThreat*3.5
			
			angles := []float64{0, math.Pi/4, -math.Pi/4, math.Pi/2, -math.Pi/2}
			radius := 4.8 // search within 4.8 meters
			for _, ang := range angles {
				candX := clamp(baseTargetX + math.Cos(ang)*radius, 5, state.FieldW-5)
				candY := clamp(baseTargetY + math.Sin(ang)*radius, 3, state.FieldH-3)
				
				// Offside cap check for forward candidates
				if p.Role == "ST" || p.Role == "LST" || p.Role == "RST" || p.Role == "LW" || p.Role == "RW" {
					lastDefenderX := e.getOffsideLine(state, oppTeam.ID)
					if team.AttackDir > 0 && candX >= lastDefenderX {
						continue
					}
					if team.AttackDir < 0 && candX <= lastDefenderX {
						continue
					}
				}
				
				// Evaluate space and lane risk
				sp := nearestOpponentDistanceVec(candX, candY, oppTeam.Players)
				laneThreat := passingLaneRiskFromCoord(state.Ball.X, state.Ball.Y, candX, candY, oppTeam.Players)
				
				// Score favors points that are far from defenders (sp) and have a clean passing lane (low laneThreat)
				score := sp - laneThreat*3.5
				if score > maxScore {
					maxScore = score
					bestX = candX
					bestY = candY
				}
			}

			targetX = bestX
			targetY = bestY
		}

		isPressingChaser := !sameTeamAsAttacker && hasAttackingPossession && distance(p.X, p.Y, state.Ball.X, state.Ball.Y) < (11.0 + team.Tactics.Pressure*15.0)

		if isNearestChaser || isPressingChaser {
			predX, predY := e.predictBallIntercept(state, p)
			targetX = predX
			targetY = predY
			if tickEvents != nil && !sameTeamAsAttacker && hasPossessor && e.rand.Float64() < 0.025 {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:     "pressing_trigger",
					TeamID:   p.TeamID,
					PlayerID: p.ID,
					Message:  fmt.Sprintf("%s triggers pressure pressing", p.Role),
				})
			}
		}

		// Tight 1-on-1 defensive marking and active pressing for other non-chasing defenders (kèm 1-1, pressing)
		if !sameTeamAsAttacker && hasAttackingPossession && !isNearestChaser && !isPressingChaser && p.Role != "GK" {
			nearestAttacker := nearestOpponent(p, oppTeam.Players)
			if nearestAttacker != nil {
				attackerSpace := nearestOpponentDistance(nearestAttacker, team.Players) // space attacker has from other defenders
				
				// Determine goal line to stand between attacker and goal
				goalX := 0.0
				if p.TeamID == state.HomeTeam.ID {
					goalX = 0.0
				} else {
					goalX = state.FieldW
				}

				distToGoal := distance(nearestAttacker.X, nearestAttacker.Y, goalX, state.FieldH/2)
				
				if distToGoal < 30.0 || attackerSpace > 6.0 {
					// Mark extremely tight (1-on-1): stand 90% close to them, blocking the passing lane
					ballDist := distance(state.Ball.X, state.Ball.Y, nearestAttacker.X, nearestAttacker.Y)
					if ballDist > 4.0 {
						// Position directly in the passing lane: 78% towards attacker, 12% towards ball, 10% goal line
						targetX = nearestAttacker.X * 0.78 + state.Ball.X * 0.12 + goalX * 0.10
						targetY = nearestAttacker.Y * 0.78 + state.Ball.Y * 0.12 + (state.FieldH/2) * 0.10
					} else {
						// Extremely close tight marking
						targetX = nearestAttacker.X * 0.90 + goalX * 0.10
						targetY = nearestAttacker.Y * 0.90 + (state.FieldH/2) * 0.10
					}
				} else {
					// Standard defensive tracking
					targetX = nearestAttacker.X*0.70 + goalX*0.30
					targetY = nearestAttacker.Y*0.70 + (state.FieldH/2)*0.30
				}
			}
		}

		if isPossessor {
			if p.Role == "GK" {
				targetX = p.HomeX
				targetY = clamp(state.FieldH/2+(state.Ball.Y-state.FieldH/2)*0.18, 10, state.FieldH-10)
			} else {
				goalX := 0.0
				if p.TeamID == state.HomeTeam.ID {
					goalX = state.FieldW
				}
				targetX = goalX
				targetY = state.FieldH / 2
			}
		}

		if p.Role == "GK" && !isPossessor {
			targetX = p.HomeX
			targetY = clamp(state.FieldH/2+(state.Ball.Y-state.FieldH/2)*0.28, 10, state.FieldH-10)
		}

		repelX, repelY := 0.0, 0.0
		for _, other := range state.AllPlayers() {
			if other.ID == p.ID {
				continue
			}
			d := distance(p.X, p.Y, other.X, other.Y)
			if d < 1.5 {
				force := (1.5 - d) * 0.25
				repelX += (p.X - other.X) / (d + 0.1) * force
				repelY += (p.Y - other.Y) / (d + 0.1) * force
			}
		}

		if p.ReactionDelay > 0 {
			p.ReactionDelay--
			p.X += p.VX
			p.Y += p.VY
			p.VX *= 0.92
			p.VY *= 0.92
		} else {
			dx := (targetX + repelX) - p.X
			dy := (targetY + repelY) - p.Y
			dist := math.Sqrt(dx*dx + dy*dy)

			desiredVX := 0.0
			desiredVY := 0.0
			if dist > 0.05 {
				maxStep := e.paceStep(p.Pace) * (1.0 - p.Fatigue*0.15) * (0.85 + p.Morale*0.15)
				desiredVX = dx / dist * maxStep
				desiredVY = dy / dist * maxStep
			}

			turnRate := 0.28 + float64(p.Mental)*0.0018
			p.VX += (desiredVX - p.VX) * turnRate
			p.VY += (desiredVY - p.VY) * turnRate

			p.X += p.VX
			p.Y += p.VY
		}

		if p.Role == "GK" {
			p.X, p.Y = clampGoalkeeperPosition(p, state)
		} else {
			p.X = clamp(p.X, 1.2, state.FieldW-1.2)
			p.Y = clamp(p.Y, 1.2, state.FieldH-1.2)
		}

		runDist := math.Sqrt(p.VX*p.VX + p.VY*p.VY)
		p.Fatigue = clamp(p.Fatigue+runDist*0.0012, 0.0, 1.0)
	}
}

func (e *MatchEngine) updateState(state *rooms.MatchState) []events.MatchEvent {
	tickEvents := make([]events.MatchEvent, 0, 4)

	e.computePlayerMovement(state, &tickEvents)

	if state.Ball.OwnerID == 0 {
		e.updateBall(state)
		e.resolveLooseBall(state, &tickEvents)
	} else {
		e.resolvePossessionPlay(state, &tickEvents)
		e.updateBall(state)
	}

	if e.rand.Float64() < 0.006 {
		homePressure := state.HomeTeam.Tactics.Pressure
		awayPressure := state.AwayTeam.Tactics.Pressure
		if homePressure > 0.65 && awayPressure < 0.45 {
			tickEvents = append(tickEvents, events.MatchEvent{
				Kind:    "domination_phase",
				TeamID:  state.HomeTeam.ID,
				Message: "Home team exerting immense high pressing dominance!",
			})
		} else if awayPressure > 0.65 && homePressure < 0.45 {
			tickEvents = append(tickEvents, events.MatchEvent{
				Kind:    "domination_phase",
				TeamID:  state.AwayTeam.ID,
				Message: "Away team dominating the possession and territory!",
			})
		} else {
			tickEvents = append(tickEvents, events.MatchEvent{
				Kind:    "momentum_shift",
				Message: "Tactical chess match in progress: both teams contesting the midfield!",
			})
		}
	}

	if e.rand.Float64() < 0.015 {
		for _, p := range state.AllPlayers() {
			if p.Fatigue > 0.82 && e.rand.Float64() < 0.25 {
				tickEvents = append(tickEvents, events.MatchEvent{
					Kind:     "fatigue_warning",
					TeamID:   p.TeamID,
					PlayerID: p.ID,
					Message:  fmt.Sprintf("%s is looking exhausted! Running on empty.", p.Role),
				})
				p.Pace = maxInt(p.Pace-2, 30)
				break
			}
		}
	}

	for _, ev := range tickEvents {
		e.queueEvent(ev)
	}

	return e.processQueue()
}

func clampGoalkeeperPosition(p *rooms.Player, state *rooms.MatchState) (float64, float64) {
	if p.TeamID == state.HomeTeam.ID {
		return clamp(p.X, gkHomeMinX, gkHomeMaxX), clamp(p.Y, 8, state.FieldH-8)
	}
	return clamp(p.X, gkAwayMinX, gkAwayMaxX), clamp(p.Y, 8, state.FieldH-8)
}

func (e *MatchEngine) resolveLooseBall(state *rooms.MatchState, tickEvents *[]events.MatchEvent) {
	if state.Ball.InFlight {
		if e.tryResolveFlightContact(state, tickEvents) {
			return
		}

		if state.Ball.FlightLeft > 0.45 {
			return
		}

		state.Ball.InFlight = false
		state.Ball.IsLob = false
		state.Ball.Height = 0
		state.Ball.VX *= 0.35
		state.Ball.VY *= 0.35
	}

	allPlayers := state.AllPlayers()
	nearest := nearestToBall(allPlayers, state.Ball.X, state.Ball.Y)
	if nearest == nil {
		return
	}

	if distance(nearest.X, nearest.Y, state.Ball.X, state.Ball.Y) < 1.15 {
		e.giveBallToPlayer(state, nearest)
		// *tickEvents = append(*tickEvents, events.MatchEvent{
		// 	Kind:     "possession_change",
		// 	TeamID:   nearest.TeamID,
		// 	PlayerID: nearest.ID,
		// 	Message:  "Recovered possession",
		// })
	}
}

func (e *MatchEngine) resolvePossessionPlay(state *rooms.MatchState, tickEvents *[]events.MatchEvent) {
	owner := findPlayerByID(state.AllPlayers(), state.Ball.OwnerID)
	if owner == nil {
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		return
	}

	team := state.HomeTeam
	opponent := state.AwayTeam
	if owner.TeamID == state.AwayTeam.ID {
		team = state.AwayTeam
		opponent = state.HomeTeam
	}

	distGoal := distanceToGoal(owner, state)
	nearestDef := nearestOpponent(owner, opponent.Players)

	// 1. Tackle Check
	foulProb := 0.0
	tackleTriggered := false
	if nearestDef != nil {
		duelDist := distance(owner.X, owner.Y, nearestDef.X, nearestDef.Y)
		if duelDist < 1.45 {
			tackleTriggered = true
			tackleAggression := clamp(float64(nearestDef.SlidingTackle-nearestDef.StandingTackle)/100.0, -0.15, 0.18)
			attackerAgility := clamp((float64(owner.Pace)+float64(owner.Mental))/220.0, 0.35, 0.92)
			riskyZone := clamp(1.0-distGoal/28.0, 0, 1)

			foulProb = clamp(
				0.02+
					(1.45-duelDist)*0.18+
					tackleAggression*0.08+
					opponent.Tactics.Pressure*0.05+
					riskyZone*0.04+
					attackerAgility*0.03,
				0.015,
				0.38,
			)
		}
	}

	if tackleTriggered {
		tackleProb := clamp(float64(nearestDef.StandingTackle)*0.0075+0.16-owner.Pressure*0.12+nearestDef.Morale*0.08, 0.12, 0.82)
		if e.rand.Float64() < tackleProb {
			if e.rand.Float64() < foulProb {
				e.handleFoul(state, nearestDef, owner, tickEvents)
				return
			}

			owner.HasBall = false
			e.giveBallToPlayer(state, nearestDef)
			kind := "tackle"
			msg := fmt.Sprintf("%s makes brilliant standing tackle", nearestDef.Role)
			if e.rand.Float64() < 0.35 {
				kind = "sliding_tackle"
				msg = fmt.Sprintf("SPECTACULAR SLIDING TACKLE BY %s!", nearestDef.Role)
				nearestDef.Morale += 0.06
				owner.Morale -= 0.05
			}
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     kind,
				TeamID:   nearestDef.TeamID,
				PlayerID: nearestDef.ID,
				Message:  msg,
			})
			return
		}
	}

	// 2. Utility Decision System
	scoreShoot := -999.0
	angle := math.Abs(owner.Y-state.FieldH/2) / (distGoal + 0.1)
	if distGoal < 32.0 {
		scoreShoot = float64(owner.Shooting)*0.85 + float64(owner.Mental)*0.45 + (1.0-owner.Pressure)*35.0 - distGoal*1.8 - angle*22.0 + owner.Morale*12.0
		scoreShoot += (team.Tactics.ShotRatio - 0.5) * 20.0
	}

	scorePass := -999.0
	var passDec *passDecision
	if decision := e.bestPassDecision(state, owner, team, opponent); decision != nil {
		passDec = decision
		mateSpace := nearestOpponentDistance(decision.target, opponent.Players)
		mateProgress := forwardProgress(owner, decision.target, state)
		scorePass = decision.success*95.0 + mateProgress*0.95 + mateSpace*1.2 - owner.Pressure*28.0
		scorePass += (team.Tactics.PassRatio - 0.5) * 15.0
	}

	scoreCross := -999.0
	inCrossingZone := (owner.TeamID == "home" && owner.X > 68.0 && (owner.Y < 13.0 || owner.Y > 51.0)) ||
		(owner.TeamID == "away" && owner.X < 32.0 && (owner.Y < 13.0 || owner.Y > 51.0))
	if inCrossingZone {
		scoreCross = float64(owner.Passing)*0.82 + float64(owner.Vision)*0.65 + owner.Morale*10.0 - owner.Pressure*20.0
	}

	scoreClearance := -999.0
	inOwnBox := (owner.TeamID == "home" && owner.X < 18.0) || (owner.TeamID == "away" && owner.X > 82.0)
	if inOwnBox && owner.Pressure > 0.45 {
		scoreClearance = owner.Pressure*125.0 + float64(owner.Defending)*0.45 - owner.Morale*8.0
	}

	scoreDribble := float64(owner.Pace)*0.55 + float64(owner.Mental)*0.35 + (1.0-owner.Pressure)*22.0 - distGoal*0.35 + owner.Morale*8.0

	highestVal := scoreDribble
	choice := "dribble"

	if scoreShoot > highestVal {
		highestVal = scoreShoot
		choice = "shoot"
	}
	if scorePass > highestVal {
		highestVal = scorePass
		choice = "pass"
	}
	if scoreCross > highestVal {
		highestVal = scoreCross
		choice = "cross"
	}
	if scoreClearance > highestVal {
		highestVal = scoreClearance
		choice = "clear"
	}

	switch choice {
	case "shoot":
		if highestVal > 50.0 {
			e.handleShot(state, owner, opponent, tickEvents)
		}
	case "pass":
		if highestVal > 40.0 && passDec != nil {
			e.handlePassWithDecision(state, owner, team, opponent, passDec, tickEvents)
		}
	case "cross":
		if highestVal > 48.0 {
			e.handleCross(state, owner, team, opponent, tickEvents)
		}
	case "clear":
		if highestVal > 55.0 {
			e.handleClearance(state, owner, opponent, tickEvents)
		}
	default:
		if owner.Pressure < 0.25 && e.rand.Float64() < 0.02 {
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     "skill_move",
				TeamID:   owner.TeamID,
				PlayerID: owner.ID,
				Message:  fmt.Sprintf("%s executes elegant nutmeg skill move", owner.Role),
			})
			owner.Morale += 0.04
		}
	}
}

func (e *MatchEngine) handlePassWithDecision(state *rooms.MatchState, owner *rooms.Player, team *rooms.Team, opponent *rooms.Team, decision *passDecision, tickEvents *[]events.MatchEvent) {
	if decision == nil || decision.target == nil {
		return
	}

	passType := "ground"
	if decision.isLob {
		passType = "lob"
	}
	successPct := int(math.Round(decision.success * 100))

	isThroughBall := false
	dir := ownerTeam(owner.TeamID, state).AttackDir
	if (decision.target.X-owner.X)*dir > 12.0 && nearestOpponentDistance(decision.target, opponent.Players) > 3.8 {
		isThroughBall = true
		passType = "through_ball"
	}

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:       "pass",
		TeamID:     owner.TeamID,
		PlayerID:   owner.ID,
		ReceiverID: decision.target.ID,
		PassType:   passType,
		SuccessPct: successPct,
		Message:    fmt.Sprintf("Attempted %s pass", passType),
	})

	isAccurate := e.rand.Float64() <= decision.success
	noiseBase := (1.0 - decision.success) * 2.2
	if !isAccurate {
		noiseBase += 3.8
		owner.Morale = clamp(owner.Morale-0.03, 0.5, 1.5)
	} else {
		owner.Morale = clamp(owner.Morale+0.02, 0.5, 1.5)
	}

	targetX := clamp(decision.targetX+(e.rand.Float64()-0.5)*noiseBase, 0, state.FieldW)
	targetY := clamp(decision.targetY+(e.rand.Float64()-0.5)*noiseBase*0.6, 0, state.FieldH)
	targetID := decision.target.ID
	if !isAccurate {
		targetID = 0
	}

	if isThroughBall && isAccurate {
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:       "through_ball",
			TeamID:     owner.TeamID,
			PlayerID:   owner.ID,
			ReceiverID: targetID,
			Message:    "Sensational through pass!",
		})
	}

	if decision.isLob && distance(owner.X, owner.Y, targetX, targetY) > 28.0 && isAccurate {
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:       "long_pass",
			TeamID:     owner.TeamID,
			PlayerID:   owner.ID,
			ReceiverID: targetID,
			Message:    "Beautiful diagonal long pass",
		})
	}

	e.startPassFlight(state, owner, team.ID, targetID, targetX, targetY, decision.initialSpeed, decision.isLob)
}

func (e *MatchEngine) handlePass(state *rooms.MatchState, owner *rooms.Player, team *rooms.Team, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	decision := e.bestPassDecision(state, owner, team, opponent)
	e.handlePassWithDecision(state, owner, team, opponent, decision, tickEvents)
}

func (e *MatchEngine) handleCross(state *rooms.MatchState, owner *rooms.Player, team *rooms.Team, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	var strikers []*rooms.Player
	for _, p := range team.Players {
		if strings.Contains(p.Role, "ST") || strings.Contains(p.Role, "W") || strings.Contains(p.Role, "AM") {
			strikers = append(strikers, p)
		}
	}

	var target *rooms.Player
	if len(strikers) > 0 {
		target = strikers[e.rand.Intn(len(strikers))]
	} else {
		target = team.Players[len(team.Players)-1]
	}

	owner.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.PassTeamID = team.ID
	state.Ball.InFlight = true
	state.Ball.IsLob = true
	state.Ball.TargetID = target.ID

	noise := 3.2 - float64(owner.Passing)*0.02
	state.Ball.TargetX = clamp(target.X+(e.rand.Float64()-0.5)*noise, 0, state.FieldW)
	state.Ball.TargetY = clamp(target.Y+(e.rand.Float64()-0.5)*noise, 0, state.FieldH)

	dist := distance(owner.X, owner.Y, state.Ball.TargetX, state.Ball.TargetY)
	state.Ball.FlightTotal = dist
	state.Ball.FlightLeft = dist

	dx := state.Ball.TargetX - owner.X
	dy := state.Ball.TargetY - owner.Y
	state.Ball.VX = dx / dist * 1.85
	state.Ball.VY = dy / dist * 1.85
	state.Ball.VZ = 1.15
	state.Ball.Height = 0.3

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:       "cross",
		TeamID:     owner.TeamID,
		PlayerID:   owner.ID,
		ReceiverID: target.ID,
		Message:    "Excellent cross into the box",
	})
}

func (e *MatchEngine) handleClearance(state *rooms.MatchState, owner *rooms.Player, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	owner.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.PassTeamID = ""
	state.Ball.TargetID = 0
	state.Ball.InFlight = true
	state.Ball.IsLob = true

	dir := ownerTeam(owner.TeamID, state).AttackDir
	state.Ball.TargetX = clamp(owner.X+dir*(32.0+e.rand.Float64()*20.0), 10, state.FieldW-10)
	state.Ball.TargetY = clamp(state.FieldH/2+(e.rand.Float64()-0.5)*35.0, 10, state.FieldH-10)

	dist := distance(owner.X, owner.Y, state.Ball.TargetX, state.Ball.TargetY)
	state.Ball.FlightTotal = dist
	state.Ball.FlightLeft = dist

	dx := state.Ball.TargetX - owner.X
	dy := state.Ball.TargetY - owner.Y
	state.Ball.VX = dx / dist * 2.2
	state.Ball.VY = dy / dist * 2.2
	state.Ball.VZ = 1.35
	state.Ball.Height = 0.4

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "clearance",
		TeamID:   owner.TeamID,
		PlayerID: owner.ID,
		Message:  "Panic clearance down field!",
	})
}

func (e *MatchEngine) handleShot(state *rooms.MatchState, owner *rooms.Player, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	// 1. Calculate Shot Power (Lực sút) in km/h:
	// A standard shot ranges from 65km/h to 138km/h depending on Shooting stat, Morale, and random noise.
	baseShotPower := 1.45 + float64(owner.Shooting)/72.0 + e.rand.Float64()*0.55
	shotSpeedKmh := baseShotPower * 42.0 + float64(owner.Shooting)*0.22 + e.rand.Float64()*12.0
	shotSpeedKmh = clamp(shotSpeedKmh, 65.0, 138.0)

	// 2. Calculate GK saving capability (Khả năng chụp của thủ môn) out of 100:
	gk := findGoalkeeper(opponent)
	gkSavingCapability := 50
	gkID := 0
	if gk != nil {
		gkID = gk.ID
		// stats: Defending (as Goalkeeping), Pace (as Agility/Reflexes), Mental, Morale
		gkSavingCapability = int(clamp(float64(gk.Defending)*0.45 + float64(gk.Pace)*0.25 + float64(gk.Mental)*0.15 + (gk.Morale * 10.0), 10, 99))
	}

	distGoal := distanceToGoal(owner, state)
	defenseBlock := teamDefendingAverage(opponent.Players) / 200.0

	// 3. Expected Goals (xG) calculation integrating shot power and GK saving capability:
	// High shot speed reduces GK reaction and increases goal probability.
	// High GK saving capability reduces goal probability.
	gkDefenseFactor := float64(gkSavingCapability) / 100.0
	speedFactor := shotSpeedKmh / 100.0 // 1.0 is average 100km/h

	xg := clamp(0.05 + float64(owner.Shooting)/170.0 + float64(owner.Mental)/500.0 - distGoal/110.0 - defenseBlock, 0.02, 0.72)
	xg = clamp(xg * speedFactor * (1.8 - gkDefenseFactor * 1.2), 0.01, 0.85)
	xg = clamp(xg + ownerTeam(owner.TeamID, state).Tactics.ShotRatio*0.1 - opponent.Tactics.Pressure*0.06 + owner.Morale*0.05, 0.01, 0.88)

	isGoal := e.rand.Float64() < xg
	shotOnTarget := isGoal
	if !shotOnTarget {
		onTargetProb := clamp(0.22 + float64(owner.Shooting)/260.0 - distGoal/210.0 - opponent.Tactics.Pressure*0.05, 0.12, 0.66)
		shotOnTarget = e.rand.Float64() < onTargetProb
	}

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:         "shot",
		TeamID:       owner.TeamID,
		PlayerID:     owner.ID,
		ShotPower:    round2(shotSpeedKmh),
		ShotOnTarget: shotOnTarget,
		GKCapability: gkSavingCapability,
		Message:      fmt.Sprintf("%s fires a powerful shot! [Power: %.1f km/h, GK Save Capability: %d%%]", owner.Role, shotSpeedKmh, gkSavingCapability),
	})

	if !isGoal {
		owner.HasBall = false
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		state.Ball.PassTeamID = ""
		state.Ball.TargetID = 0
		state.Ball.InFlight = true
		state.Ball.IsLob = false
		state.Ball.TargetX = clamp(owner.X+ownerGoalDirection(owner.TeamID, state)*(16+e.rand.Float64()*18), 0, state.FieldW)
		state.Ball.TargetY = clamp(state.FieldH/2+(e.rand.Float64()-0.5)*16, 0, state.FieldH)
		state.Ball.FlightTotal = distance(owner.X, owner.Y, state.Ball.TargetX, state.Ball.TargetY)
		state.Ball.FlightLeft = state.Ball.FlightTotal
		dx := state.Ball.TargetX - owner.X
		dy := state.Ball.TargetY - owner.Y
		d := math.Max(math.Sqrt(dx*dx+dy*dy), 0.01)
		
		// Map ball speed to the shot speed scale
		ballSpeedScale := clamp(shotSpeedKmh / 42.0, 1.7, 3.2)
		state.Ball.VX = dx / d * ballSpeedScale
		state.Ball.VY = dy / d * ballSpeedScale
		state.Ball.VZ = 0.28 + e.rand.Float64()*0.42
		state.Ball.Height = 0.35

		// Goalpost/Woodwork interaction:
		// If shot is on target but doesn't go in, it can strike the post or crossbar (woodwork).
		// Higher shot power combined with slightly off-center accuracy makes striking the post more likely.
		woodworkChance := 0.08 + (shotSpeedKmh/150.0)*0.06
		if shotOnTarget && e.rand.Float64() < woodworkChance {
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     "woodwork_hit",
				TeamID:   owner.TeamID,
				PlayerID: owner.ID,
				Message:  fmt.Sprintf("STRIKES THE WOODWORK! A fierce %.1f km/h rocket rattles the post!", shotSpeedKmh),
			})
			state.Ball.VX = -state.Ball.VX * 0.42
			state.Ball.VY = (e.rand.Float64() - 0.5) * 2.2
			state.Ball.VZ = 0.65
			owner.Morale = clamp(owner.Morale-0.10, 0.5, 1.5)
			return
		}

		// Defender block interaction:
		if e.rand.Float64() < 0.25 {
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     "blocked_shot",
				TeamID:   opponent.ID,
				PlayerID: opponent.Players[e.rand.Intn(len(opponent.Players))].ID,
				Message:  "Sensational block by defender!",
			})
			state.Ball.VX = -state.Ball.VX * 0.22
			state.Ball.VY = (e.rand.Float64() - 0.5) * 1.5
			state.Ball.VZ = 0.12
			return
		}

		// Goalkeeper save interaction:
		if shotOnTarget {
			saveRoll := e.rand.Float64()
			if gk != nil {
				gk.Morale = clamp(gk.Morale+0.08, 0.5, 1.5)
			}
			owner.Morale = clamp(owner.Morale-0.04, 0.5, 1.5)

			// GK capability determines world-class great saves!
			greatSaveChance := float64(gkSavingCapability) * 0.0042 // up to 42% chance of a world-class save
			if saveRoll < greatSaveChance {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:          "great_save",
					TeamID:        opponent.ID,
					PlayerID:      gkID,
					InterceptorID: gkID,
					Message:       fmt.Sprintf("SENSATIONAL DIVE! GK denies a %.1f km/h rocket with a world-class save!", shotSpeedKmh),
				})
			} else {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:          "save",
					TeamID:        opponent.ID,
					PlayerID:      gkID,
					InterceptorID: gkID,
					Message:       "Comfortable save by the goalkeeper",
				})
			}

			if e.rand.Float64() < 0.45 {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:    "rebound",
					TeamID:  owner.TeamID,
					Message: "Rebound! The ball is loose in the penalty box!",
				})
				state.Ball.VX = -state.Ball.VX * 0.25
				state.Ball.VY = (e.rand.Float64() - 0.5) * 2.8
				state.Ball.VZ = 0.38
			} else {
				if gk != nil {
					e.giveBallToPlayer(state, gk)
				}
			}
		}
		return
	}

	goalCounted := true
	if e.rand.Float64() < 0.22 {
		goalCounted = e.rand.Float64() > 0.18
		msg := "VAR check: goal confirmed"
		if !goalCounted {
			msg = "VAR: goal disallowed for offside!"
		}
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "var", TeamID: owner.TeamID, PlayerID: owner.ID, Message: msg})
	}

	if !goalCounted {
		owner.HasBall = false
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		return
	}

	if owner.TeamID == state.HomeTeam.ID {
		state.HomeTeam.Score++
	} else {
		state.AwayTeam.Score++
	}
	owner.Morale = clamp(owner.Morale+0.20, 0.5, 1.5)
	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "goal", TeamID: owner.TeamID, PlayerID: owner.ID, Message: "GOOOOOAL!!!"})
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "player_celebration",
		TeamID:   owner.TeamID,
		PlayerID: owner.ID,
		Message:  fmt.Sprintf("%s runs to the corner flag to celebrate with the crowd!", owner.Role),
	})

	owner.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.VX = 0
	state.Ball.VY = 0
	state.Ball.VZ = 0
	state.Ball.Height = 0
	state.Ball.InFlight = false

	if owner.TeamID == state.HomeTeam.ID {
		state.Ball.X = state.FieldW + 0.8
		state.Ball.Y = state.FieldH / 2
	} else {
		state.Ball.X = -0.8
		state.Ball.Y = state.FieldH / 2
	}

	kickoffTeamID := oppositeTeamID(owner.TeamID, state)
	cornerX := state.FieldW - 0.5
	cornerY := 0.5 // Top right flag
	if owner.TeamID == state.AwayTeam.ID {
		cornerX = 0.5
		cornerY = 0.5 // Top left flag
	}
	
	e.celebration = &celebrationState{
		scorerID:      owner.ID,
		teamID:        owner.TeamID,
		kickoffTeamID: kickoffTeamID,
		ticksLeft:     35, // ~3.5 seconds of high-fidelity celebration
		cornerX:       cornerX,
		cornerY:       cornerY,
	}
}

func (e *MatchEngine) handleFoul(state *rooms.MatchState, defender *rooms.Player, attacker *rooms.Player, tickEvents *[]events.MatchEvent) {
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "foul",
		TeamID:   defender.TeamID,
		PlayerID: defender.ID,
		Message:  fmt.Sprintf("Foul on player %d", attacker.ID),
	})

	isPenalty := isInPenaltyArea(attacker, state)
	distToGoal := distanceToGoal(attacker, state)
	
	spType := setPieceFarFreeKick
	if isPenalty {
		spType = setPiecePenalty
	} else if distToGoal < 32.0 {
		spType = setPieceNearFreeKick
	}

	if isPenalty {
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:     "penalty_awarded",
			TeamID:   attacker.TeamID,
			PlayerID: attacker.ID,
			Message:  "Penalty awarded",
		})
	} else {
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:     "free_kick",
			TeamID:   attacker.TeamID,
			PlayerID: attacker.ID,
			Message:  "Free kick awarded",
		})
	}

	dangerFactor := clamp(1.0-distToGoal/35.0, 0, 1)
	aggression := clamp(float64(defender.SlidingTackle-defender.StandingTackle)/100.0, -0.15, 0.22)
	cardRoll := e.rand.Float64()
	redThreshold := clamp(0.04+dangerFactor*0.08+aggression*0.1, 0.03, 0.22)
	yellowThreshold := clamp(redThreshold+0.24+dangerFactor*0.14+aggression*0.1, redThreshold+0.14, 0.86)

	if cardRoll < redThreshold {
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "red_card", TeamID: defender.TeamID, PlayerID: defender.ID, Message: "Straight red card!"})
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:     "captain_argument",
			TeamID:   defender.TeamID,
			PlayerID: defender.ID,
			Message:  "Uproar on the pitch! Captains confront the referee over the red card!",
		})
		defender.Pace = maxInt(defender.Pace-8, 35)
		defender.Defending = maxInt(defender.Defending-10, 30)
		defender.SlidingTackle = maxInt(defender.SlidingTackle-12, 30)
		defender.StandingTackle = maxInt(defender.StandingTackle-8, 30)
		defender.Morale = clamp(defender.Morale-0.35, 0.5, 1.5)
	} else if cardRoll < yellowThreshold {
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "yellow_card", TeamID: defender.TeamID, PlayerID: defender.ID, Message: "Yellow card"})
		if e.rand.Float64() < 0.35 {
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     "referee_warning",
				TeamID:   defender.TeamID,
				PlayerID: defender.ID,
				Message:  "Referee giving a final warning to the defender.",
			})
		}
		defender.Defending = maxInt(defender.Defending-3, 30)
		defender.SlidingTackle = maxInt(defender.SlidingTackle-4, 30)
		defender.Morale = clamp(defender.Morale-0.12, 0.5, 1.5)
	}

	attacking := ownerTeam(attacker.TeamID, state)
	defending := state.HomeTeam
	if attacking.ID == state.HomeTeam.ID {
		defending = state.AwayTeam
	}
	
	// Determine designated kicker
	var kicker *rooms.Player
	if spType == setPiecePenalty {
		kicker = choosePenaltyTaker(attacking, attacker)
	} else if spType == setPieceNearFreeKick {
		kicker = chooseFreeKickTaker(attacking, attacker)
	}
	if kicker == nil {
		kicker = attacker
	}

	e.setPiece = &setPieceState{
		Type:        spType,
		TeamID:      attacking.ID,
		DefTeamID:   defending.ID,
		FoulX:       attacker.X,
		FoulY:       attacker.Y,
		KickerID:    kicker.ID,
		KickerObj:   kicker,
		GKObj:       findGoalkeeper(defending),
		TicksLeft:   30, // 3 seconds delay for suspense and repositioning!
		Initialized: false,
		Executed:    false,
	}
}

func (e *MatchEngine) handlePenaltyKick(state *rooms.MatchState, fouled *rooms.Player, tickEvents *[]events.MatchEvent) {
	attacking := ownerTeam(fouled.TeamID, state)
	defending := state.HomeTeam
	if attacking.ID == state.HomeTeam.ID {
		defending = state.AwayTeam
	}

	taker := choosePenaltyTaker(attacking, fouled)
	if taker == nil {
		taker = fouled
	}
	if taker == nil {
		return
	}

	gk := findGoalkeeper(defending)

	spotX := 11.0
	if attacking.ID == state.HomeTeam.ID {
		spotX = state.FieldW - 11.0
	}
	spotY := state.FieldH / 2

	taker.X = spotX
	taker.Y = spotY
	e.giveBallToPlayer(state, taker)

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "penalty_taken",
		TeamID:   attacking.ID,
		PlayerID: taker.ID,
		Message:  "Penalty kick taken",
	})

	takerSkill := clamp(float64(taker.Shooting)/120.0+float64(taker.Mental)/260.0+float64(taker.Vision)/450.0, 0.35, 1.2)
	gkSkill := 0.62
	if gk != nil {
		gkSkill = clamp(float64(gk.Defending)/160.0+float64(gk.StandingTackle)/260.0+float64(gk.Mental)/360.0, 0.38, 1.1)
	}

	missChance := clamp(0.045+(1.0-takerSkill)*0.06+defending.Tactics.Pressure*0.03, 0.03, 0.18)
	saveChance := clamp(0.16+gkSkill*0.27-takerSkill*0.14+defending.Tactics.Pressure*0.05, 0.08, 0.52)

	roll := e.rand.Float64()
	if roll < missChance {
		taker.HasBall = false
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		state.Ball.PassTeamID = ""
		state.Ball.InFlight = false
		state.Ball.VX = 0
		state.Ball.VY = 0
		state.Ball.X = clamp(spotX+ownerGoalDirection(attacking.ID, state)*6.5, 0, state.FieldW)
		state.Ball.Y = clamp(spotY+(e.rand.Float64()-0.5)*9.5, 0, state.FieldH)

		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:     "penalty_missed",
			TeamID:   attacking.ID,
			PlayerID: taker.ID,
			Message:  "Penalty missed",
		})
		return
	}

	if roll < missChance+saveChance {
		if gk != nil {
			e.giveBallToPlayer(state, gk)
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:          "penalty_saved",
				TeamID:        gk.TeamID,
				PlayerID:      gk.ID,
				ReceiverID:    taker.ID,
				InterceptorID: gk.ID,
				Message:       "Goalkeeper saved the penalty",
			})
			return
		}

		taker.HasBall = false
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		state.Ball.PassTeamID = ""
		state.Ball.InFlight = false
		state.Ball.VX = 0
		state.Ball.VY = 0

		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:     "penalty_saved",
			TeamID:   defending.ID,
			PlayerID: taker.ID,
			Message:  "Penalty saved",
		})
		return
	}

	if attacking.ID == state.HomeTeam.ID {
		state.HomeTeam.Score++
	} else {
		state.AwayTeam.Score++
	}

	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "penalty_scored", TeamID: attacking.ID, PlayerID: taker.ID, Message: "Penalty scored"})
	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "goal", TeamID: attacking.ID, PlayerID: taker.ID, Message: "Goal scored"})
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "player_celebration",
		TeamID:   attacking.ID,
		PlayerID: taker.ID,
		Message:  fmt.Sprintf("%s runs to the corner flag to celebrate with the crowd!", taker.Role),
	})

	taker.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.VX = 0
	state.Ball.VY = 0
	state.Ball.VZ = 0
	state.Ball.Height = 0
	state.Ball.InFlight = false

	if attacking.ID == state.HomeTeam.ID {
		state.Ball.X = state.FieldW + 0.8
		state.Ball.Y = state.FieldH / 2
	} else {
		state.Ball.X = -0.8
		state.Ball.Y = state.FieldH / 2
	}

	kickoffTeamID := oppositeTeamID(attacking.ID, state)
	cornerX := state.FieldW - 0.5
	cornerY := 0.5 // Top right flag
	if attacking.ID == state.AwayTeam.ID {
		cornerX = 0.5
		cornerY = 0.5 // Top left flag
	}
	
	e.celebration = &celebrationState{
		scorerID:      taker.ID,
		teamID:        attacking.ID,
		kickoffTeamID: kickoffTeamID,
		ticksLeft:     35, // ~3.5 seconds of high-fidelity celebration
		cornerX:       cornerX,
		cornerY:       cornerY,
	}
}

func choosePenaltyTaker(team *rooms.Team, preferred *rooms.Player) *rooms.Player {
	if team == nil || len(team.Players) == 0 {
		return nil
	}

	best := team.Players[0]
	bestScore := -1.0

	for _, p := range team.Players {
		score := float64(p.Shooting)*1.45 + float64(p.Mental)*0.95 + float64(p.Vision)*0.55
		if preferred != nil && p.ID == preferred.ID {
			score += 6
		}
		if p.Role == "GK" {
			score -= 25
		}
		if score > bestScore {
			bestScore = score
			best = p
		}
	}

	return best
}

func findGoalkeeper(team *rooms.Team) *rooms.Player {
	if team == nil || len(team.Players) == 0 {
		return nil
	}

	for _, p := range team.Players {
		if p.Role == "GK" {
			return p
		}
	}

	return team.Players[0]
}

func isInPenaltyArea(attacker *rooms.Player, state *rooms.MatchState) bool {
	if attacker == nil || state == nil {
		return false
	}

	inY := attacker.Y >= 12 && attacker.Y <= (state.FieldH-12)
	if !inY {
		return false
	}

	if attacker.TeamID == state.HomeTeam.ID {
		return attacker.X >= (state.FieldW - 16.5)
	}

	return attacker.X <= 16.5
}

func (e *MatchEngine) prepareKickoffSequence(state *rooms.MatchState, kickoffTeamID string, message string) []events.MatchEvent {
	kickoffPlayer, receiver := e.resetKickoff(state, kickoffTeamID)
	tickEvents := []events.MatchEvent{{Kind: "kickoff", TeamID: kickoffTeamID, Message: message}}

	if kickoffPlayer == nil || receiver == nil {
		e.kickoff = nil
		return tickEvents
	}

	e.kickoff = &kickoffPassState{
		teamID:     kickoffTeamID,
		passerID:   kickoffPlayer.ID,
		receiverID: receiver.ID,
		delayTicks: 2, // ~200ms with 100ms tick interval
	}

	return tickEvents
}

func (e *MatchEngine) executeKickoffPass(state *rooms.MatchState) []events.MatchEvent {
	if e.kickoff == nil {
		return nil
	}

	passer := findPlayerByID(state.AllPlayers(), e.kickoff.passerID)
	receiver := findPlayerByID(state.AllPlayers(), e.kickoff.receiverID)
	teamID := e.kickoff.teamID
	e.kickoff = nil

	if passer == nil || receiver == nil {
		return nil
	}

	dist := distance(passer.X, passer.Y, receiver.X, receiver.Y)
	kickoffSpeed := clamp(e.passBallSpeed(passer.Passing, dist, false)*0.64, 0.5, 0.85)
	e.startPassFlight(state, passer, teamID, receiver.ID, receiver.X, receiver.Y, kickoffSpeed, false)

	return []events.MatchEvent{{
		Kind:       "pass",
		TeamID:     teamID,
		PlayerID:   passer.ID,
		ReceiverID: receiver.ID,
		PassType:   "ground",
		SuccessPct: 100,
		Message:    "Kickoff short pass",
	}}
}

func (e *MatchEngine) resetKickoff(state *rooms.MatchState, kickoffTeamID string) (*rooms.Player, *rooms.Player) {
	for _, p := range state.AllPlayers() {
		p.X = p.HomeX
		p.Y = p.HomeY
		p.HasBall = false
	}

	state.Ball.X = state.FieldW / 2
	state.Ball.Y = state.FieldH / 2
	state.Ball.VX = 0
	state.Ball.VY = 0
	state.Ball.Height = 0
	state.Ball.InFlight = false
	state.Ball.IsLob = false
	state.Ball.PassTeamID = ""
	state.Ball.TargetID = 0
	state.Ball.TargetX = state.Ball.X
	state.Ball.TargetY = state.Ball.Y
	state.Ball.FlightLeft = 0
	state.Ball.FlightTotal = 0
	state.Ball.OwnerTeamID = kickoffTeamID

	for _, p := range state.HomeTeam.Players {
		p.X = clamp(p.X, 0, 49.4)
	}
	for _, p := range state.AwayTeam.Players {
		p.X = clamp(p.X, 50.6, state.FieldW)
	}

	kickoffTeam := state.HomeTeam
	if kickoffTeamID == state.AwayTeam.ID {
		kickoffTeam = state.AwayTeam
	}

	if len(kickoffTeam.Players) == 0 {
		state.Ball.OwnerID = 0
		return nil, nil
	}

	kickoffPlayer := kickoffTeam.Players[9]
	if len(kickoffTeam.Players) <= 9 {
		kickoffPlayer = kickoffTeam.Players[len(kickoffTeam.Players)-1]
	}

	receiver := kickoffTeam.Players[6]
	if len(kickoffTeam.Players) <= 6 || receiver.ID == kickoffPlayer.ID {
		receiver = kickoffTeam.Players[0]
		for _, candidate := range kickoffTeam.Players {
			if candidate.ID != kickoffPlayer.ID {
				receiver = candidate
				break
			}
		}
	}

	kickoffPlayer.X = state.FieldW / 2
	kickoffPlayer.Y = state.FieldH / 2
	receiver.X = clamp(state.FieldW/2-kickoffTeam.AttackDir*2.4, 0, state.FieldW)
	receiver.Y = clamp(state.FieldH/2+1.3, 0, state.FieldH)

	kickoffPlayer.HasBall = true
	state.Ball.OwnerID = kickoffPlayer.ID

	return kickoffPlayer, receiver
}

func (e *MatchEngine) updateBall(state *rooms.MatchState) {
	if e.celebration != nil || e.substitution != nil {
		return
	}
	for _, p := range state.AllPlayers() {
		if p.ID == state.Ball.OwnerID {
			state.Ball.X = clamp(p.X+ownerGoalDirection(p.TeamID, state)*0.38, 0.4, state.FieldW-0.4)
			state.Ball.Y = clamp(p.Y, 0.4, state.FieldH-0.4)
			state.Ball.VX = 0
			state.Ball.VY = 0
			state.Ball.VZ = 0
			state.Ball.Height = 0
			state.Ball.Spin = 0
			state.Ball.InFlight = false
			state.Ball.IsLob = false
			state.Ball.PassTeamID = ""
			state.Ball.TargetID = 0
			state.Ball.FlightTotal = 0
			state.Ball.FlightLeft = 0
			return
		}
	}

	if state.Ball.InFlight {
		if math.Abs(state.Ball.Spin) > 0.01 {
			driftScale := 0.05
			driftX := -state.Ball.VY * state.Ball.Spin * driftScale
			driftY := state.Ball.VX * state.Ball.Spin * driftScale
			state.Ball.VX += driftX
			state.Ball.VY += driftY
		}

		state.Ball.VZ -= 0.155

		state.Ball.VX *= 0.985
		state.Ball.VY *= 0.985
		state.Ball.VZ *= 0.985

		state.Ball.X += state.Ball.VX
		state.Ball.Y += state.Ball.VY
		state.Ball.Height += state.Ball.VZ

		if state.Ball.X <= 0.2 || state.Ball.X >= state.FieldW-0.2 {
			state.Ball.VX = -state.Ball.VX * 0.35
			state.Ball.X = clamp(state.Ball.X, 0.2, state.FieldW-0.2)
		}
		if state.Ball.Y <= 0.2 || state.Ball.Y >= state.FieldH-0.2 {
			state.Ball.VY = -state.Ball.VY * 0.35
			state.Ball.Y = clamp(state.Ball.Y, 0.2, state.FieldH-0.2)
		}

		if state.Ball.Height <= 0.0 {
			if state.Ball.VZ < -0.14 {
				state.Ball.Height = 0.0
				state.Ball.VZ = -state.Ball.VZ * 0.44
				state.Ball.VX *= 0.84
				state.Ball.VY *= 0.84
			} else {
				state.Ball.Height = 0.0
				state.Ball.VZ = 0.0
				state.Ball.InFlight = false
				state.Ball.IsLob = false
				state.Ball.Spin = 0
			}
		}
	} else {
		state.Ball.Height = 0.0
		state.Ball.VZ = 0.0
		state.Ball.X += state.Ball.VX
		state.Ball.Y += state.Ball.VY

		state.Ball.VX *= 0.88
		state.Ball.VY *= 0.88

		if state.Ball.X <= 0.2 || state.Ball.X >= state.FieldW-0.2 {
			state.Ball.VX = -state.Ball.VX * 0.28
			state.Ball.X = clamp(state.Ball.X, 0.2, state.FieldW-0.2)
		}
		if state.Ball.Y <= 0.2 || state.Ball.Y >= state.FieldH-0.2 {
			state.Ball.VY = -state.Ball.VY * 0.28
			state.Ball.Y = clamp(state.Ball.Y, 0.2, state.FieldH-0.2)
		}

		if math.Abs(state.Ball.VX) < 0.01 && math.Abs(state.Ball.VY) < 0.01 {
			state.Ball.VX = 0
			state.Ball.VY = 0
		}
	}
}

func (e *MatchEngine) broadcastTick(state *rooms.MatchState, tick int, tickEvents []events.MatchEvent) {
	players := make([]events.PlayerSnapshot, 0, len(state.AllPlayers()))
	for _, p := range state.AllPlayers() {
		players = append(players, events.PlayerSnapshot{
			ID:      p.ID,
			TeamID:  p.TeamID,
			Role:    p.Role,
			X:       round2(p.X),
			Y:       round2(p.Y),
			HasBall: p.HasBall,
			Name:    p.Name,
			Avatar:  p.Avatar,
			Fatigue: round2(p.Fatigue),
			Morale:  round2(p.Morale),
		})
	}

	reserves := make([]events.PlayerSnapshot, 0, len(state.HomeTeam.Reserves)+len(state.AwayTeam.Reserves))
	for _, p := range state.HomeTeam.Reserves {
		reserves = append(reserves, events.PlayerSnapshot{
			ID:      p.ID,
			TeamID:  p.TeamID,
			Role:    p.Role,
			X:       -20,
			Y:       -20,
			HasBall: false,
			Name:    p.Name,
			Avatar:  p.Avatar,
			Fatigue: round2(p.Fatigue),
			Morale:  round2(p.Morale),
		})
	}
	for _, p := range state.AwayTeam.Reserves {
		reserves = append(reserves, events.PlayerSnapshot{
			ID:      p.ID,
			TeamID:  p.TeamID,
			Role:    p.Role,
			X:       -20,
			Y:       -20,
			HasBall: false,
			Name:    p.Name,
			Avatar:  p.Avatar,
			Fatigue: round2(p.Fatigue),
			Morale:  round2(p.Morale),
		})
	}

 	payload := events.TickPayload{
		Type:         "match_tick",
		MatchID:      state.MatchID,
		HomeTeamName: state.HomeTeam.Name,
		AwayTeamName: state.AwayTeam.Name,
		Tick:         tick,
		ElapsedMS:    state.Elapsed.Milliseconds(),
		Score: events.ScoreSnapshot{
			Home: state.HomeTeam.Score,
			Away: state.AwayTeam.Score,
		},
		Ball: events.BallSnapshot{
			X:           round2(state.Ball.X),
			Y:           round2(state.Ball.Y),
			VX:          round2(state.Ball.VX),
			VY:          round2(state.Ball.VY),
			Height:      round2(state.Ball.Height),
			InFlight:    state.Ball.InFlight,
			OwnerTeamID: state.Ball.OwnerTeamID,
			OwnerID:     state.Ball.OwnerID,
		},
		Players:  players,
		Reserves: reserves,
		Events:  tickEvents,
		Debug:   e.buildDebugSnapshot(state),
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		return
	}
	e.hub.Publish(bytes)
}

func (e *MatchEngine) buildDebugSnapshot(state *rooms.MatchState) events.DebugSnapshot {
	debug := events.DebugSnapshot{
		Gameplay: events.GameplayDebugSnapshot{
			Mode:               e.runtime.Mode,
			PassSpeedScale:     round2(e.runtime.PassSpeedScale),
			InterceptionRadius: round2(e.runtime.InterceptionRadius),
			GKBuildUpBias:      round2(e.runtime.GKBuildUpBias),
			TempoScale:         round2(e.runtime.TempoScale),
		},
	}

	if state.Ball.OwnerID == 0 {
		return debug
	}

	owner := findPlayerByID(state.AllPlayers(), state.Ball.OwnerID)
	if owner == nil {
		return debug
	}

	team := state.HomeTeam
	opponent := state.AwayTeam
	if owner.TeamID == state.AwayTeam.ID {
		team = state.AwayTeam
		opponent = state.HomeTeam
	}

	decision := e.bestPassDecision(state, owner, team, opponent)
	if decision == nil || decision.target == nil {
		return debug
	}

	preview := &events.PassPreviewSnapshot{
		FromX:      round2(owner.X),
		FromY:      round2(owner.Y),
		ToX:        round2(decision.targetX),
		ToY:        round2(decision.targetY),
		SuccessPct: int(math.Round(decision.success * 100)),
		ReceiverID: decision.target.ID,
	}
	if decision.isLob {
		preview.PassType = "lob"
	} else {
		preview.PassType = "ground"
	}

	ix, iy, ok := e.estimateLaneInterceptionPoint(owner, decision.target, opponent.Players)
	if ok {
		preview.HasLaneRisk = true
		preview.LaneRiskX = round2(ix)
		preview.LaneRiskY = round2(iy)
	}

	debug.PassPreview = preview
	return debug
}

func (e *MatchEngine) estimateLaneInterceptionPoint(owner *rooms.Player, target *rooms.Player, opponents []*rooms.Player) (float64, float64, bool) {
	segLen := distance(owner.X, owner.Y, target.X, target.Y)
	if segLen < 0.1 {
		return 0, 0, false
	}

	bestScore := -1.0
	bestX := 0.0
	bestY := 0.0
	reach := 1.1 * e.runtime.InterceptionRadius

	for _, o := range opponents {
		along, perp := projectionDistance(owner.X, owner.Y, target.X, target.Y, o.X, o.Y)
		if along < 0 || along > segLen || perp > reach {
			continue
		}

		score := (1.0 - perp/reach) * (0.45 + float64(o.StandingTackle)/250.0 + float64(o.Defending)/420.0)
		if score <= bestScore {
			continue
		}

		ux := (target.X - owner.X) / segLen
		uy := (target.Y - owner.Y) / segLen
		bestX = owner.X + ux*along
		bestY = owner.Y + uy*along
		bestScore = score
	}

	if bestScore < 0 {
		return 0, 0, false
	}
	return bestX, bestY, true
}

func findPlayerByID(players []*rooms.Player, id int) *rooms.Player {
	for _, p := range players {
		if p.ID == id {
			return p
		}
	}
	return nil
}

func nearestToBall(players []*rooms.Player, x float64, y float64) *rooms.Player {
	if len(players) == 0 {
		return nil
	}
	nearest := players[0]
	bestDist := distance(players[0].X, players[0].Y, x, y)
	for _, p := range players[1:] {
		d := distance(p.X, p.Y, x, y)
		if d < bestDist {
			bestDist = d
			nearest = p
		}
	}
	return nearest
}

func nearestOpponent(owner *rooms.Player, opponents []*rooms.Player) *rooms.Player {
	if len(opponents) == 0 {
		return nil
	}
	nearest := opponents[0]
	best := distance(owner.X, owner.Y, nearest.X, nearest.Y)
	for _, p := range opponents[1:] {
		d := distance(owner.X, owner.Y, p.X, p.Y)
		if d < best {
			best = d
			nearest = p
		}
	}
	return nearest
}

func nearestOpponentDistance(player *rooms.Player, opponents []*rooms.Player) float64 {
	if len(opponents) == 0 {
		return 99
	}
	best := distance(player.X, player.Y, opponents[0].X, opponents[0].Y)
	for _, o := range opponents[1:] {
		d := distance(player.X, player.Y, o.X, o.Y)
		if d < best {
			best = d
		}
	}
	return best
}

func passingLaneRisk(owner *rooms.Player, target *rooms.Player, opponents []*rooms.Player) float64 {
	segLen := distance(owner.X, owner.Y, target.X, target.Y)
	if segLen < 0.1 {
		return 0
	}

	risk := 0.0
	for _, o := range opponents {
		along, perp := projectionDistance(owner.X, owner.Y, target.X, target.Y, o.X, o.Y)
		if along < 0 || along > segLen {
			continue
		}
		if perp > 4.4 {
			continue
		}

		lineThreat := (1.0 - perp/4.4) * (0.46 + float64(o.StandingTackle)/260.0 + float64(o.Defending)/460.0)
		risk += lineThreat
	}

	return clamp(risk, 0, 3.8)
}

func nearestOpponentDistanceVec(x float64, y float64, opponents []*rooms.Player) float64 {
	if len(opponents) == 0 {
		return 99.0
	}
	best := distance(x, y, opponents[0].X, opponents[0].Y)
	for _, o := range opponents[1:] {
		d := distance(x, y, o.X, o.Y)
		if d < best {
			best = d
		}
	}
	return best
}

func passingLaneRiskFromCoord(fromX float64, fromY float64, toX float64, toY float64, opponents []*rooms.Player) float64 {
	segLen := distance(fromX, fromY, toX, toY)
	if segLen < 0.1 {
		return 0
	}

	risk := 0.0
	for _, o := range opponents {
		along, perp := projectionDistance(fromX, fromY, toX, toY, o.X, o.Y)
		if along < 0 || along > segLen {
			continue
		}
		if perp > 4.4 {
			continue
		}

		lineThreat := (1.0 - perp/4.4) * (0.46 + float64(o.StandingTackle)/260.0 + float64(o.Defending)/460.0)
		risk += lineThreat
	}

	return clamp(risk, 0, 3.8)
}

func projectionDistance(x1 float64, y1 float64, x2 float64, y2 float64, px float64, py float64) (float64, float64) {
	vx := x2 - x1
	vy := y2 - y1
	seg := math.Sqrt(vx*vx + vy*vy)
	if seg == 0 {
		return 0, distance(x1, y1, px, py)
	}
	ux := vx / seg
	uy := vy / seg
	proj := (px-x1)*ux + (py-y1)*uy
	closestX := x1 + proj*ux
	closestY := y1 + proj*uy
	perp := distance(px, py, closestX, closestY)
	return proj, perp
}

func forwardProgress(owner *rooms.Player, target *rooms.Player, state *rooms.MatchState) float64 {
	dir := ownerGoalDirection(owner.TeamID, state)
	return (target.X - owner.X) * dir
}

func (e *MatchEngine) bestPassDecision(state *rooms.MatchState, owner *rooms.Player, team *rooms.Team, opponent *rooms.Team) *passDecision {
	nearestDef := nearestOpponent(owner, opponent.Players)
	pressure := 0.0
	if nearestDef != nil {
		pressure = clamp((10.0-distance(owner.X, owner.Y, nearestDef.X, nearestDef.Y))/10.0, 0, 1)
	}

	var best *passDecision
	bestScore := -9999.0

	for _, mate := range team.Players {
		if mate.ID == owner.ID {
			continue
		}

		dist := distance(owner.X, owner.Y, mate.X, mate.Y)
		if dist < 3.5 || dist > 58 {
			continue
		}

		space := nearestOpponentDistance(mate, opponent.Players)
		laneRisk := passingLaneRisk(owner, mate, opponent.Players)
		progress := forwardProgress(owner, mate, state)

		for _, isLob := range []bool{false, true} {
			if isLob && dist < 17 {
				continue
			}
			if !isLob && dist > 38 {
				continue
			}

			success := estimatePassSuccess(owner, mate, team, opponent, dist, laneRisk, space, pressure, isLob)
			score := success*120.0 + progress*0.62 + space*1.05 - laneRisk*24.0

			if owner.Role == "GK" {
				score += e.goalkeeperBuildUpBias(mate, dist, isLob)
			}

			if score > bestScore {
				bestScore = score
				passSkill := owner.Passing
				if isLob {
					passSkill = owner.LongPass
				}
				best = &passDecision{
					target:       mate,
					isLob:        isLob,
					success:      success,
					targetX:      mate.X,
					targetY:      mate.Y,
					initialSpeed: e.passBallSpeed(passSkill, dist, isLob),
				}
			}
		}
	}

	return best
}

func (e *MatchEngine) goalkeeperBuildUpBias(target *rooms.Player, dist float64, isLob bool) float64 {
	bias := 0.0
	if target.Role == "LB" || target.Role == "RB" || target.Role == "LCB" || target.Role == "RCB" {
		bias += 10
	}
	if target.Role == "CM" || target.Role == "LCM" || target.Role == "RCM" {
		bias += 8
	}
	if target.Role == "ST" {
		bias -= 18
	}
	if dist > 34 && !isLob {
		bias -= 14
	}
	if isLob && dist > 30 {
		bias += 2
	}
	return bias * e.runtime.GKBuildUpBias
}

func estimatePassSuccess(owner *rooms.Player, target *rooms.Player, team *rooms.Team, opponent *rooms.Team, dist float64, laneRisk float64, space float64, pressure float64, isLob bool) float64 {
	passSkill := owner.Passing
	if isLob {
		passSkill = owner.LongPass
	}

	base := 0.26 + float64(passSkill)/150.0 + float64(owner.Vision)/280.0 + float64(target.Mental)/420.0
	distancePenalty := dist / 100.0
	if isLob {
		distancePenalty = dist / 125.0
	}

	lanePenalty := laneRisk * 0.18
	if isLob {
		lanePenalty = laneRisk * 0.12
	}

	spaceBoost := clamp(space/24.0, 0, 0.2)
	tacticBoost := team.Tactics.PassRatio*0.08 - opponent.Tactics.Pressure*0.06
	
	// Heavy pressure penalty: passing success rate falls by up to 52% if opponent defenders are tight
	pressurePenalty := pressure * 0.52

	if isLob {
		base += 0.03
	}

	return clamp(base-distancePenalty-lanePenalty-pressurePenalty+spaceBoost+tacticBoost, 0.10, 0.92)
}

func (e *MatchEngine) passBallSpeed(ownerPassSkill int, dist float64, isLob bool) float64 {
	// Dynamically calculate speed factor from the player's passing attribute!
	// 99 passing gives a 1.15x speed multiplier, whereas 50 passing gives a 0.98x multiplier.
	skillFactor := 0.85 + float64(ownerPassSkill)/380.0
	if isLob {
		// Raised base speed range from [0.95, 2.1] to [1.25, 2.7] for crisp, organic lobs!
		return clamp((1.25+dist*0.018)*e.runtime.PassSpeedScale*skillFactor, 1.15, 2.7)
	}
	// Raised base speed range from [0.72, 1.85] to [0.98, 2.45] for crisp, responsive ground passes!
	return clamp((0.98+dist*0.020)*e.runtime.PassSpeedScale*skillFactor, 0.95, 2.45)
}

func (e *MatchEngine) startPassFlight(state *rooms.MatchState, owner *rooms.Player, passTeamID string, targetID int, targetX float64, targetY float64, speed float64, isLob bool) {
	dx := targetX - owner.X
	dy := targetY - owner.Y
	d := math.Sqrt(dx*dx + dy*dy)
	if d < 0.01 {
		return
	}

	owner.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.PassTeamID = passTeamID
	state.Ball.TargetID = targetID
	state.Ball.TargetX = targetX
	state.Ball.TargetY = targetY
	state.Ball.InFlight = true
	state.Ball.IsLob = isLob
	state.Ball.FlightTotal = d
	state.Ball.FlightLeft = d
	state.Ball.X = owner.X
	state.Ball.Y = owner.Y
	state.Ball.VX = dx / d * speed
	state.Ball.VY = dy / d * speed
	if isLob {
		state.Ball.VZ = clamp(d*0.048, 0.65, 1.35)
		state.Ball.Spin = (e.rand.Float64() - 0.5) * 0.42
	} else {
		state.Ball.VZ = 0
		state.Ball.Spin = 0
	}
	state.Ball.Height = 0.28
}

func (e *MatchEngine) tryResolveFlightContact(state *rooms.MatchState, tickEvents *[]events.MatchEvent) bool {
	passingTeamID := state.Ball.PassTeamID
	intendedReceiver := state.Ball.TargetID
	passType := "ground"
	if state.Ball.IsLob {
		passType = "lob"
	}
	var best *rooms.Player
	bestSkill := 0.0

	for _, p := range state.AllPlayers() {
		reach := 0.95 * e.runtime.InterceptionRadius
		if state.Ball.IsLob {
			reach = 0.88 * e.runtime.InterceptionRadius
			if state.Ball.Height > 1.5 {
				reach = 0.62 * e.runtime.InterceptionRadius
			}
		}

		d := distance(p.X, p.Y, state.Ball.X, state.Ball.Y)
		if d > reach {
			continue
		}

		control := 0.2 + float64(p.Mental)/380.0 + float64(p.Pace)/520.0
		if p.TeamID == state.Ball.PassTeamID {
			control += float64(p.Passing) / 280.0
		} else {
			control += float64(p.StandingTackle) / 270.0
			control += float64(p.SlidingTackle) / 360.0
		}

		control += (reach - d) * 0.45
		if state.Ball.IsLob && state.Ball.Height > 1.2 {
			control *= 0.65
		}

		if control > bestSkill {
			bestSkill = control
			best = p
		}
	}

	if best == nil {
		return false
	}

	chance := clamp(0.2+bestSkill*0.34, 0.2, 0.9)
	if e.rand.Float64() > chance {
		return false
	}

	e.giveBallToPlayer(state, best)
	msg := "Pass received"
	if best.TeamID != passingTeamID {
		msg = "Pass intercepted"
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:          "interception",
			TeamID:        best.TeamID,
			PlayerID:      best.ID,
			InterceptorID: best.ID,
			ReceiverID:    intendedReceiver,
			PassType:      passType,
			Message:       msg,
		})
	}
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:       "possession_change",
		TeamID:     best.TeamID,
		PlayerID:   best.ID,
		ReceiverID: intendedReceiver,
		PassType:   passType,
		InterceptorID: func() int {
			if best.TeamID != passingTeamID {
				return best.ID
			}
			return 0
		}(),
		Message: msg,
	})
	return true
}

func (e *MatchEngine) giveBallToPlayer(state *rooms.MatchState, owner *rooms.Player) {
	for _, p := range state.AllPlayers() {
		p.HasBall = false
	}

	owner.HasBall = true
	state.Ball.OwnerID = owner.ID
	state.Ball.OwnerTeamID = owner.TeamID
	state.Ball.VX = 0
	state.Ball.VY = 0
	state.Ball.Height = 0
	state.Ball.InFlight = false
	state.Ball.IsLob = false
	state.Ball.PassTeamID = ""
	state.Ball.TargetID = 0
	state.Ball.FlightLeft = 0
	state.Ball.FlightTotal = 0
}

func teamDefendingAverage(players []*rooms.Player) float64 {
	if len(players) == 0 {
		return 0
	}
	sum := 0
	for _, p := range players {
		sum += p.Defending + p.StandingTackle + p.SlidingTackle
	}
	return float64(sum) / float64(len(players)*3)
}

func distanceToGoal(p *rooms.Player, state *rooms.MatchState) float64 {
	goalX := 0.0
	if p.TeamID == state.HomeTeam.ID {
		goalX = state.FieldW
	}
	return distance(p.X, p.Y, goalX, state.FieldH/2)
}

func ownerGoalDirection(teamID string, state *rooms.MatchState) float64 {
	if teamID == state.HomeTeam.ID {
		return 1
	}
	return -1
}

func oppositeTeamID(teamID string, state *rooms.MatchState) string {
	if teamID == state.HomeTeam.ID {
		return state.AwayTeam.ID
	}
	return state.HomeTeam.ID
}

func ownerTeam(teamID string, state *rooms.MatchState) *rooms.Team {
	if teamID == state.HomeTeam.ID {
		return state.HomeTeam
	}
	return state.AwayTeam
}

func (e *MatchEngine) paceStep(pace int) float64 {
	return (0.16 + float64(pace)*0.0038) * e.runtime.TempoScale
}

func moveTowards(x float64, y float64, tx float64, ty float64, maxStep float64) (float64, float64) {
	dx := tx - x
	dy := ty - y
	d := math.Sqrt(dx*dx + dy*dy)
	if d < 0.06 {
		return x, y
	}
	if d == 0 || d <= maxStep {
		return tx, ty
	}
	return x + dx/d*maxStep, y + dy/d*maxStep
}

func distance(x1 float64, y1 float64, x2 float64, y2 float64) float64 {
	dx := x1 - x2
	dy := y1 - y2
	return math.Sqrt(dx*dx + dy*dy)
}

func clamp(v float64, minV float64, maxV float64) float64 {
	if v < minV {
		return minV
	}
	if v > maxV {
		return maxV
	}
	return v
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func maxInt(a int, b int) int {
	if a > b {
		return a
	}
	return b
}

func (e *MatchEngine) updateSubstitutionTick(state *rooms.MatchState) {
	sub := e.substitution
	if sub == nil {
		return
	}

	team := state.HomeTeam
	if sub.teamID == state.AwayTeam.ID {
		team = state.AwayTeam
	}

	var playerOut *rooms.Player
	for _, p := range team.Players {
		if p.ID == sub.playerOutID {
			playerOut = p
			break
		}
	}

	// 1. Move all OTHER active players slowly towards their home positions
	for _, p := range state.AllPlayers() {
		if playerOut != nil && p.ID == playerOut.ID {
			continue
		}
		dx := p.HomeX - p.X
		dy := p.HomeY - p.Y
		dist := math.Hypot(dx, dy)
		if dist > 0.5 {
			p.X += (dx / dist) * 0.22
			p.Y += (dy / dist) * 0.22
		}
	}

	// 2. Move playerOut towards the touchline center (50, 1.2)
	if playerOut != nil {
		if !sub.outReached {
			dx := sub.outX - playerOut.X
			dy := sub.outY - playerOut.Y
			dist := math.Hypot(dx, dy)
			if dist > 0.8 {
				playerOut.X += (dx / dist) * 0.45
				playerOut.Y += (dy / dist) * 0.45
			} else {
				sub.outReached = true
				e.eventQueue = append(e.eventQueue, events.MatchEvent{
					Kind:     "substitution_highfive",
					TeamID:   sub.teamID,
					PlayerID: sub.playerInID,
					Message:  fmt.Sprintf("🤝 High five! %s enters the pitch.", sub.playerInObj.Name),
				})
			}
		} else {
			// Once high-fived, playerOut runs off pitch to technical area
			dx := 50.0 - playerOut.X
			dy := -4.0 - playerOut.Y
			dist := math.Hypot(dx, dy)
			if dist > 0.2 {
				playerOut.X += (dx / dist) * 0.38
				playerOut.Y += (dy / dist) * 0.38
			}
		}
	}

	// 3. Move playerInObj
	if sub.playerInObj != nil {
		if !sub.outReached {
			// Runs towards touchline to meet playerOut
			dx := sub.outX - sub.playerInObj.X
			dy := sub.outY - sub.playerInObj.Y
			dist := math.Hypot(dx, dy)
			if dist > 0.5 {
				sub.playerInObj.X += (dx / dist) * 0.38
				sub.playerInObj.Y += (dy / dist) * 0.38
			}
		} else {
			// Once high-fived, runs onto the pitch towards home position
			dx := sub.playerInObj.HomeX - sub.playerInObj.X
			dy := sub.playerInObj.HomeY - sub.playerInObj.Y
			dist := math.Hypot(dx, dy)
			if dist > 0.8 {
				sub.playerInObj.X += (dx / dist) * 0.45
				sub.playerInObj.Y += (dy / dist) * 0.45
			}
		}
	}
}

func (e *MatchEngine) finalizeSubstitution(state *rooms.MatchState) {
	sub := e.substitution
	if sub == nil {
		return
	}

	team := state.HomeTeam
	if sub.teamID == state.AwayTeam.ID {
		team = state.AwayTeam
	}

	// Find playerOut and playerIn
	var outIdx = -1
	for idx, p := range team.Players {
		if p.ID == sub.playerOutID {
			outIdx = idx
			break
		}
	}

	var inIdx = -1
	for idx, p := range team.Reserves {
		if p.ID == sub.playerInID {
			inIdx = idx
			break
		}
	}

	if outIdx != -1 && inIdx != -1 {
		pOut := team.Players[outIdx]
		pIn := team.Reserves[inIdx]

		// Final position swap!
		pIn.X = sub.playerInObj.X
		pIn.Y = sub.playerInObj.Y
		pIn.HomeX = pOut.HomeX
		pIn.HomeY = pOut.HomeY
		pIn.Role = pOut.Role // Inherits role/position

		// Swap them in the active and reserves lists
		team.Players[outIdx] = pIn
		team.Reserves[inIdx] = pOut

		// Send final match event
		e.eventQueue = append(e.eventQueue, events.MatchEvent{
			Kind:     "substitution_complete",
			TeamID:   team.ID,
			PlayerID: pIn.ID,
			Message:  fmt.Sprintf("✅ Thay người hoàn tất: %s vào sân thay cho %s!", pIn.Name, pOut.Name),
		})
	}

	e.substitution = nil
}

func (e *MatchEngine) updateSetPieceTick(state *rooms.MatchState) {
	if e.setPiece == nil {
		return
	}

	// Lock the ball at the foul spot, dampening any leftover physics
	if state.Ball.InFlight {
		state.Ball.VX *= 0.8
		state.Ball.VY *= 0.8
		state.Ball.VZ *= 0.8
		state.Ball.X += state.Ball.VX
		state.Ball.Y += state.Ball.VY
		state.Ball.Height += state.Ball.VZ
		if state.Ball.Height < 0 {
			state.Ball.Height = 0
			state.Ball.VZ = -state.Ball.VZ * 0.4
		}
		if state.Ball.VX*state.Ball.VX+state.Ball.VY*state.Ball.VY < 0.01 && state.Ball.Height < 0.1 {
			state.Ball.InFlight = false
		}
	} else {
		state.Ball.X = e.setPiece.FoulX
		state.Ball.Y = e.setPiece.FoulY
		state.Ball.VX = 0
		state.Ball.VY = 0
		state.Ball.VZ = 0
		state.Ball.Height = 0
	}

	goalX := 0.0
	if e.setPiece.DefTeamID == state.HomeTeam.ID {
		goalX = 0.0
	} else {
		goalX = state.FieldW
	}

	// Calculate defensive wall anchor point (9 meters away, directly between ball and goal center)
	wallX := e.setPiece.FoulX + (goalX-e.setPiece.FoulX)*0.3
	wallY := e.setPiece.FoulY + (state.FieldH/2-e.setPiece.FoulY)*0.3
	distToGoal := distance(e.setPiece.FoulX, e.setPiece.FoulY, goalX, state.FieldH/2)
	if distToGoal > 9.0 {
		dirX := (goalX - e.setPiece.FoulX) / distToGoal
		dirY := (state.FieldH/2 - e.setPiece.FoulY) / distToGoal
		wallX = e.setPiece.FoulX + dirX*9.0
		wallY = e.setPiece.FoulY + dirY*9.0
	}

	wallCount := 0
	maxWallPlayers := 4

	for _, p := range state.AllPlayers() {
		// Kicker gently walks to the ball and waits
		if p.ID == e.setPiece.KickerID {
			targetX := e.setPiece.FoulX - ownerGoalDirection(p.TeamID, state)*1.2
			targetY := e.setPiece.FoulY
			p.X += (targetX - p.X) * 0.15
			p.Y += (targetY - p.Y) * 0.15
			continue
		}

		if p.Role == "GK" {
			p.X, p.Y = clampGoalkeeperPosition(p, state)
			// Goalkeeper slightly favors the near post if there's a wall
			if e.setPiece.Type == setPieceNearFreeKick {
				p.Y += (e.setPiece.FoulY - state.FieldH/2) * 0.12
			}
			continue
		}

		if e.setPiece.Type == setPiecePenalty {
			// All other players gather outside the penalty box (arc)
			dir := ownerGoalDirection(e.setPiece.TeamID, state)
			targetX := e.setPiece.FoulX - dir*10.0
			targetY := p.HomeY
			
			// Defending players stand slightly closer
			if p.TeamID == e.setPiece.DefTeamID {
				targetX = e.setPiece.FoulX - dir*9.5
			}
			p.X += (targetX - p.X) * 0.18
			p.Y += (targetY - p.Y) * 0.18

		} else if e.setPiece.Type == setPieceNearFreeKick && p.TeamID == e.setPiece.DefTeamID && wallCount < maxWallPlayers && p.Role != "ST" {
			// Defending players form the wall
			targetX := wallX
			targetY := wallY + float64(wallCount-maxWallPlayers/2)*1.4
			p.X += (targetX - p.X) * 0.22
			p.Y += (targetY - p.Y) * 0.22
			wallCount++

		} else {
			// Generic spread out / tactical repositioning for Far Free Kicks or non-wall players
			targetX := p.HomeX*0.8 + e.setPiece.FoulX*0.2
			targetY := p.HomeY*0.8 + e.setPiece.FoulY*0.2

			// Ensure defending players maintain 9m distance from ball
			distToBall := distance(targetX, targetY, e.setPiece.FoulX, e.setPiece.FoulY)
			if p.TeamID == e.setPiece.DefTeamID && distToBall < 9.0 {
				targetX = e.setPiece.FoulX + (targetX-e.setPiece.FoulX)/distToBall*9.5
				targetY = e.setPiece.FoulY + (targetY-e.setPiece.FoulY)/distToBall*9.5
			}

			p.X += (targetX - p.X) * 0.15
			p.Y += (targetY - p.Y) * 0.15
		}

		p.X = clamp(p.X, 1.2, state.FieldW-1.2)
		p.Y = clamp(p.Y, 1.2, state.FieldH-1.2)
	}
}

func (e *MatchEngine) executeSetPiece(state *rooms.MatchState) []events.MatchEvent {
	e.setPiece.Executed = true
	tickEvents := make([]events.MatchEvent, 0)

	if e.setPiece.Type == setPiecePenalty {
		e.handlePenaltyKick(state, e.setPiece.KickerObj, &tickEvents)
	} else if e.setPiece.Type == setPieceNearFreeKick {
		e.executeDirectFreeKick(state, &tickEvents)
	} else {
		// Far free kick - treated as a tactical pass execution
		tickEvents = append(tickEvents, events.MatchEvent{
			Kind:     "pass",
			TeamID:   e.setPiece.TeamID,
			PlayerID: e.setPiece.KickerID,
			Message:  "Takes the free kick to restart play.",
		})

		e.giveBallToPlayer(state, e.setPiece.KickerObj)
		team := state.HomeTeam
		opponent := state.AwayTeam
		if e.setPiece.TeamID == state.AwayTeam.ID {
			team = state.AwayTeam
			opponent = state.HomeTeam
		}
		
		e.handlePass(state, e.setPiece.KickerObj, team, opponent, &tickEvents)
	}

	e.setPiece = nil
	return tickEvents
}

func (e *MatchEngine) executeDirectFreeKick(state *rooms.MatchState, tickEvents *[]events.MatchEvent) {
	owner := e.setPiece.KickerObj
	opponent := state.HomeTeam
	if owner.TeamID == state.HomeTeam.ID {
		opponent = state.AwayTeam
	}

	distGoal := distanceToGoal(owner, state)
	baseShotPower := 1.45 + float64(owner.Shooting)/72.0 + e.rand.Float64()*0.45
	shotSpeedKmh := baseShotPower*42.0 + float64(owner.Shooting)*0.22 + e.rand.Float64()*12.0
	shotSpeedKmh = clamp(shotSpeedKmh, 75.0, 142.0)

	gkSavingCapability := 50
	gkID := 0
	if e.setPiece.GKObj != nil {
		gkID = e.setPiece.GKObj.ID
		gkSavingCapability = int(clamp(float64(e.setPiece.GKObj.Defending)*0.45+float64(e.setPiece.GKObj.Pace)*0.25+float64(e.setPiece.GKObj.Mental)*0.15+(e.setPiece.GKObj.Morale*10.0), 10, 99))
	}

	gkDefenseFactor := float64(gkSavingCapability) / 100.0
	speedFactor := shotSpeedKmh / 100.0

	xg := clamp(0.12+float64(owner.Shooting)/140.0+float64(owner.Vision)/300.0-distGoal/95.0, 0.05, 0.85)
	xg = clamp(xg*speedFactor*(1.8-gkDefenseFactor*1.2), 0.01, 0.85)
	xg = clamp(xg+owner.Morale*0.05, 0.01, 0.88)

	isGoal := e.rand.Float64() < xg
	shotOnTarget := isGoal
	if !shotOnTarget {
		onTargetProb := clamp(0.35+float64(owner.Shooting)/180.0-distGoal/180.0, 0.20, 0.75)
		shotOnTarget = e.rand.Float64() < onTargetProb
	}

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:         "shot",
		TeamID:       owner.TeamID,
		PlayerID:     owner.ID,
		ShotPower:    round2(shotSpeedKmh),
		ShotOnTarget: shotOnTarget,
		GKCapability: gkSavingCapability,
		Message:      fmt.Sprintf("DIRECT FREE KICK! %s strikes a beautiful curling shot at %.1f km/h!", owner.Role, shotSpeedKmh),
	})

	if !isGoal {
		owner.HasBall = false
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		state.Ball.PassTeamID = ""
		state.Ball.TargetID = 0
		state.Ball.InFlight = true
		state.Ball.IsLob = false
		state.Ball.TargetX = clamp(owner.X+ownerGoalDirection(owner.TeamID, state)*(16+e.rand.Float64()*18), 0, state.FieldW)
		state.Ball.TargetY = clamp(state.FieldH/2+(e.rand.Float64()-0.5)*16, 0, state.FieldH)
		state.Ball.FlightTotal = distance(owner.X, owner.Y, state.Ball.TargetX, state.Ball.TargetY)
		state.Ball.FlightLeft = state.Ball.FlightTotal
		dx := state.Ball.TargetX - owner.X
		dy := state.Ball.TargetY - owner.Y
		d := math.Max(math.Sqrt(dx*dx+dy*dy), 0.01)

		ballSpeedScale := clamp(shotSpeedKmh/42.0, 1.7, 3.2)
		state.Ball.VX = dx / d * ballSpeedScale
		state.Ball.VY = dy / d * ballSpeedScale
		state.Ball.VZ = 0.35 + e.rand.Float64()*0.42
		state.Ball.Height = 0.35
		state.Ball.Spin = (e.rand.Float64() - 0.5) * 2.8 // Very high Magnus spin curl

		woodworkChance := 0.12 + (shotSpeedKmh/150.0)*0.06
		if shotOnTarget && e.rand.Float64() < woodworkChance {
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     "woodwork_hit",
				TeamID:   owner.TeamID,
				PlayerID: owner.ID,
				Message:  "OFF THE POST! The beautifully curled free kick is denied by the woodwork!",
			})
			state.Ball.VX = -state.Ball.VX * 0.42
			state.Ball.VY = (e.rand.Float64() - 0.5) * 2.2
			state.Ball.VZ = 0.65
			owner.Morale = clamp(owner.Morale-0.10, 0.5, 1.5)
			return
		}

		if e.rand.Float64() < 0.25 {
			*tickEvents = append(*tickEvents, events.MatchEvent{
				Kind:     "blocked_shot",
				TeamID:   opponent.ID,
				PlayerID: opponent.Players[e.rand.Intn(len(opponent.Players))].ID,
				Message:  "The defensive wall jumps and bravely blocks the free kick!",
			})
			state.Ball.VX = -state.Ball.VX * 0.22
			state.Ball.VY = (e.rand.Float64() - 0.5) * 1.5
			state.Ball.VZ = 0.12
			return
		}

		if shotOnTarget {
			saveRoll := e.rand.Float64()
			if e.setPiece.GKObj != nil {
				e.setPiece.GKObj.Morale = clamp(e.setPiece.GKObj.Morale+0.08, 0.5, 1.5)
			}
			owner.Morale = clamp(owner.Morale-0.04, 0.5, 1.5)

			greatSaveChance := float64(gkSavingCapability) * 0.005
			if saveRoll < greatSaveChance {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:          "great_save",
					TeamID:        opponent.ID,
					PlayerID:      gkID,
					InterceptorID: gkID,
					Message:       "SENSATIONAL FLYING SAVE! The keeper tips the curling free kick away!",
				})
			} else {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:          "save",
					TeamID:        opponent.ID,
					PlayerID:      gkID,
					InterceptorID: gkID,
					Message:       "The keeper anticipates the curve and comfortably catches the free kick.",
				})
			}

			if e.rand.Float64() < 0.35 {
				*tickEvents = append(*tickEvents, events.MatchEvent{
					Kind:    "rebound",
					TeamID:  owner.TeamID,
					Message: "Rebound! The ball is spilled inside the box!",
				})
				state.Ball.VX = -state.Ball.VX * 0.25
				state.Ball.VY = (e.rand.Float64() - 0.5) * 2.8
				state.Ball.VZ = 0.38
			} else {
				if e.setPiece.GKObj != nil {
					e.giveBallToPlayer(state, e.setPiece.GKObj)
				}
			}
		}
		return
	}

	if owner.TeamID == state.HomeTeam.ID {
		state.HomeTeam.Score++
	} else {
		state.AwayTeam.Score++
	}
	owner.Morale = clamp(owner.Morale+0.25, 0.5, 1.5)
	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "goal", TeamID: owner.TeamID, PlayerID: owner.ID, Message: "GOAL! ABSOLUTE MAGIC FROM THE FREE KICK!"})
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "player_celebration",
		TeamID:   owner.TeamID,
		PlayerID: owner.ID,
		Message:  fmt.Sprintf("%s celebrates a world-class free kick goal!", owner.Role),
	})

	owner.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.VX = 0
	state.Ball.VY = 0
	state.Ball.VZ = 0
	state.Ball.Height = 0
	state.Ball.InFlight = false

	if owner.TeamID == state.HomeTeam.ID {
		state.Ball.X = state.FieldW + 0.8
		state.Ball.Y = state.FieldH / 2
	} else {
		state.Ball.X = -0.8
		state.Ball.Y = state.FieldH / 2
	}

	kickoffTeamID := oppositeTeamID(owner.TeamID, state)
	cornerX := state.FieldW - 0.5
	cornerY := 0.5
	if owner.TeamID == state.AwayTeam.ID {
		cornerX = 0.5
		cornerY = 0.5
	}

	e.celebration = &celebrationState{
		scorerID:      owner.ID,
		teamID:        owner.TeamID,
		kickoffTeamID: kickoffTeamID,
		ticksLeft:     35,
		cornerX:       cornerX,
		cornerY:       cornerY,
	}
}

func chooseFreeKickTaker(team *rooms.Team, fouled *rooms.Player) *rooms.Player {
	var best *rooms.Player
	bestScore := -1.0
	for _, p := range team.Players {
		if p.Role == "GK" {
			continue
		}
		score := float64(p.Passing)*0.35 + float64(p.Vision)*0.25 + float64(p.Shooting)*0.4
		if score > bestScore {
			bestScore = score
			best = p
		}
	}
	return best
}
