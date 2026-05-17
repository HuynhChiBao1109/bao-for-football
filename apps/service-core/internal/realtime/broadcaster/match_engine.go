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
	tickInterval = 100 * time.Millisecond
	matchLength  = 2 * time.Minute
	gkHomeMinX   = 2.0
	gkHomeMaxX   = 15.0
	gkAwayMinX   = 85.0
	gkAwayMaxX   = 98.0
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

type MatchEngine struct {
	hub      *hub.Hub
	rand     *rand.Rand
	mu       sync.Mutex
	running  bool
	stopCh   chan struct{}
	state    *rooms.MatchState
	kickoff  *kickoffPassState
	pending  map[string]UpdateTacticsInput
	bindings map[string]string
	runtime  gameplayRuntime
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

	go e.run("match-demo-11v11", stopCh)
}

func (e *MatchEngine) StartMatch(matchID string) error {
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

	go e.run(matchID, stopCh)
	return nil
}

func (e *MatchEngine) run(matchID string, stopCh chan struct{}) {
	state := rooms.NewDemoMatchState(matchID)
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

	kickoffEvents := e.prepareKickoffSequence(state, startingKickoffTeamID, "Match started")
	e.broadcastTick(state, 0, kickoffEvents)

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	tick := 0
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

		if halfTimeHoldTicks > 0 {
			halfTimeHoldTicks--
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
			if secondHalfKickoffDelayTicks == 0 {
				tickEvents := e.prepareKickoffSequence(state, secondHalfKickoffTeamID, "Second half kickoff")
				e.broadcastTick(state, tick, tickEvents)
			} else {
				e.broadcastTick(state, tick, nil)
			}
			e.mu.Unlock()
			continue
		}

		if e.kickoff != nil {
			e.kickoff.delayTicks--
			if e.kickoff.delayTicks <= 0 {
				tickEvents := e.executeKickoffPass(state)
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
	if input.Formation != "4-3-3" && input.Formation != "4-4-2" {
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

func (e *MatchEngine) updateState(state *rooms.MatchState) []events.MatchEvent {
	tickEvents := make([]events.MatchEvent, 0, 3)

	homeNearest := nearestToBall(state.HomeTeam.Players, state.Ball.X, state.Ball.Y)
	awayNearest := nearestToBall(state.AwayTeam.Players, state.Ball.X, state.Ball.Y)

	for _, p := range state.AllPlayers() {
		target := rooms.Vec2{X: p.HomeX, Y: p.HomeY}
		ownerID := state.Ball.OwnerID
		team := state.HomeTeam
		if p.TeamID == state.AwayTeam.ID {
			team = state.AwayTeam
		}

		sameTeamAsOwner := ownerID != 0 && p.TeamID == state.Ball.OwnerTeamID
		isPossessor := ownerID == p.ID
		isNearestChaser := (homeNearest != nil && p.ID == homeNearest.ID) || (awayNearest != nil && p.ID == awayNearest.ID)
		isPressingChaser := !sameTeamAsOwner && ownerID != 0 && distance(p.X, p.Y, state.Ball.X, state.Ball.Y) < (11.0+team.Tactics.Pressure*12.0)

		sideShift := 0.12 + team.Tactics.PassRatio*0.16
		if isNearestChaser || isPressingChaser {
			target = rooms.Vec2{X: state.Ball.X, Y: state.Ball.Y}
		} else if sameTeamAsOwner {
			target = rooms.Vec2{
				X: clamp(p.HomeX+(state.Ball.X-p.HomeX)*sideShift, 0, state.FieldW),
				Y: clamp(p.HomeY+(state.Ball.Y-p.HomeY)*sideShift, 0, state.FieldH),
			}
		}

		if isPossessor {
			if p.Role == "GK" {
				target = rooms.Vec2{X: p.HomeX, Y: clamp(state.FieldH/2+(state.Ball.Y-state.FieldH/2)*0.18, 10, state.FieldH-10)}
			} else {
				goalX := 0.0
				if p.TeamID == state.HomeTeam.ID {
					goalX = state.FieldW
				}
				target = rooms.Vec2{X: goalX, Y: state.FieldH / 2}
			}
		}

		if p.Role == "GK" && !isPossessor {
			target = rooms.Vec2{
				X: p.HomeX,
				Y: clamp(state.FieldH/2+(state.Ball.Y-state.FieldH/2)*0.28, 10, state.FieldH-10),
			}
		}

		step := e.paceStep(p.Pace)
		p.X, p.Y = moveTowards(p.X, p.Y, target.X, target.Y, step)
		if p.Role == "GK" {
			p.X, p.Y = clampGoalkeeperPosition(p, state)
		}
	}

	if state.Ball.OwnerID == 0 {
		e.updateBall(state)
		e.resolveLooseBall(state, &tickEvents)
	} else {
		e.resolvePossessionPlay(state, &tickEvents)
		e.updateBall(state)
	}

	return tickEvents
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
	shotBias := (team.Tactics.ShotRatio - 0.5) * 0.16
	passBias := (team.Tactics.PassRatio - 0.5) * 0.22
	shotProb := clamp(0.004+float64(owner.Shooting)/2300.0+float64(owner.Mental)/7000.0+(1.0-distGoal/state.FieldW)*0.08+shotBias-opponent.Tactics.Pressure*0.015, 0.01, 0.52)
	passProb := clamp(0.05+float64(owner.Passing)/1700.0+team.Tactics.Mental*0.05-opponent.Tactics.Pressing*0.03+passBias, 0.08, 0.78)

	nearestDef := nearestOpponent(owner, opponent.Players)
	foulProb := 0.0
	if nearestDef != nil {
		closePressure := clamp(1.5-distance(owner.X, owner.Y, nearestDef.X, nearestDef.Y), 0, 1.5)
		foulProb = clamp(0.004+float64(nearestDef.SlidingTackle)/3200.0+opponent.Tactics.Pressing*0.03+opponent.Tactics.Pressure*0.03+closePressure*0.02, 0.01, 0.2)
	}

	r := e.rand.Float64()
	if r < shotProb {
		e.handleShot(state, owner, opponent, tickEvents)
		return
	}

	if r < shotProb+passProb {
		e.handlePass(state, owner, team, opponent, tickEvents)
		return
	}

	if e.rand.Float64() < foulProb && nearestDef != nil {
		e.handleFoul(nearestDef, owner, tickEvents)
	}
}

func (e *MatchEngine) handlePass(state *rooms.MatchState, owner *rooms.Player, team *rooms.Team, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	decision := e.bestPassDecision(state, owner, team, opponent)
	if decision == nil || decision.target == nil {
		return
	}

	passType := "ground"
	if decision.isLob {
		passType = "lob"
	}
	successPct := int(math.Round(decision.success * 100))
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:       "pass",
		TeamID:     owner.TeamID,
		PlayerID:   owner.ID,
		ReceiverID: decision.target.ID,
		PassType:   passType,
		SuccessPct: successPct,
		Message:    "Attempted pass",
	})

	isAccurate := e.rand.Float64() <= decision.success
	noiseBase := (1.0 - decision.success) * 2.2
	if !isAccurate {
		noiseBase += 3.8
	}

	targetX := clamp(decision.targetX+(e.rand.Float64()-0.5)*noiseBase, 0, state.FieldW)
	targetY := clamp(decision.targetY+(e.rand.Float64()-0.5)*noiseBase*0.6, 0, state.FieldH)
	targetID := decision.target.ID
	if !isAccurate {
		targetID = 0
	}

	e.startPassFlight(state, owner, team.ID, targetID, targetX, targetY, decision.initialSpeed, decision.isLob)
}

func (e *MatchEngine) handleShot(state *rooms.MatchState, owner *rooms.Player, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	shotPower := clamp(1.45+float64(owner.Shooting)/72.0+e.rand.Float64()*0.55, 1.5, 3.0)

	distGoal := distanceToGoal(owner, state)
	defenseBlock := teamDefendingAverage(opponent.Players) / 200.0
	xg := clamp(0.05+float64(owner.Shooting)/170.0+float64(owner.Mental)/500.0-distGoal/110.0-defenseBlock, 0.02, 0.72)
	xg = clamp(xg+ownerTeam(owner.TeamID, state).Tactics.ShotRatio*0.1-opponent.Tactics.Pressure*0.06, 0.02, 0.78)

	isGoal := e.rand.Float64() < xg
	shotOnTarget := isGoal
	if !shotOnTarget {
		onTargetProb := clamp(0.22+float64(owner.Shooting)/260.0-distGoal/210.0-opponent.Tactics.Pressure*0.05, 0.12, 0.66)
		shotOnTarget = e.rand.Float64() < onTargetProb
	}

	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:         "shot",
		TeamID:       owner.TeamID,
		PlayerID:     owner.ID,
		ShotPower:    round2(shotPower),
		ShotOnTarget: shotOnTarget,
		Message:      "Shot attempt",
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
		state.Ball.VX = dx / d * clamp(shotPower*1.1, 1.7, 3.2)
		state.Ball.VY = dy / d * clamp(shotPower*1.1, 1.7, 3.2)
		state.Ball.Height = 0.35
		return
	}

	goalCounted := true
	if e.rand.Float64() < 0.22 {
		goalCounted = e.rand.Float64() > 0.18
		msg := "VAR check: goal confirmed"
		if !goalCounted {
			msg = "VAR: goal disallowed"
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
	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "goal", TeamID: owner.TeamID, PlayerID: owner.ID, Message: "Goal scored"})

	kickoffTeamID := oppositeTeamID(owner.TeamID, state)
	*tickEvents = append(*tickEvents, e.prepareKickoffSequence(state, kickoffTeamID, "Kickoff after goal")...)
}

func (e *MatchEngine) handleFoul(defender *rooms.Player, attacker *rooms.Player, tickEvents *[]events.MatchEvent) {
	*tickEvents = append(*tickEvents, events.MatchEvent{
		Kind:     "foul",
		TeamID:   defender.TeamID,
		PlayerID: defender.ID,
		Message:  fmt.Sprintf("Foul on player %d", attacker.ID),
	})

	cardRoll := e.rand.Float64()
	if cardRoll < 0.08 {
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "red_card", TeamID: defender.TeamID, PlayerID: defender.ID, Message: "Straight red card"})
		defender.Pace = maxInt(defender.Pace-8, 35)
		defender.Defending = maxInt(defender.Defending-10, 30)
		defender.SlidingTackle = maxInt(defender.SlidingTackle-12, 30)
		defender.StandingTackle = maxInt(defender.StandingTackle-8, 30)
		return
	}

	if cardRoll < 0.33 {
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "yellow_card", TeamID: defender.TeamID, PlayerID: defender.ID, Message: "Yellow card"})
		defender.Defending = maxInt(defender.Defending-3, 30)
		defender.SlidingTackle = maxInt(defender.SlidingTackle-4, 30)
	}
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
	kickoffSpeed := clamp(e.passBallSpeed(dist, false)*0.64, 0.5, 0.85)
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
	for _, p := range state.AllPlayers() {
		if p.ID == state.Ball.OwnerID {
			state.Ball.X = clamp(p.X+ownerGoalDirection(p.TeamID, state)*0.35, 0, state.FieldW)
			state.Ball.Y = clamp(p.Y, 0, state.FieldH)
			state.Ball.VX = 0
			state.Ball.VY = 0
			state.Ball.Height = 0
			state.Ball.InFlight = false
			state.Ball.IsLob = false
			state.Ball.PassTeamID = ""
			state.Ball.TargetID = 0
			state.Ball.FlightTotal = 0
			state.Ball.FlightLeft = 0
			return
		}
	}

	prevX := state.Ball.X
	prevY := state.Ball.Y
	state.Ball.X = clamp(state.Ball.X+state.Ball.VX, 0, state.FieldW)
	state.Ball.Y = clamp(state.Ball.Y+state.Ball.VY, 0, state.FieldH)
	moved := distance(prevX, prevY, state.Ball.X, state.Ball.Y)

	if state.Ball.InFlight {
		state.Ball.FlightLeft = math.Max(0, state.Ball.FlightLeft-moved)
		if state.Ball.IsLob && state.Ball.FlightTotal > 0 {
			progress := clamp(1.0-state.Ball.FlightLeft/state.Ball.FlightTotal, 0, 1)
			state.Ball.Height = 5.2 * 4.0 * progress * (1.0 - progress)
		} else {
			state.Ball.Height = 0
		}

		if state.Ball.FlightLeft <= 0.05 {
			state.Ball.X = state.Ball.TargetX
			state.Ball.Y = state.Ball.TargetY
		}

		state.Ball.VX *= 0.992
		state.Ball.VY *= 0.992
		return
	}

	state.Ball.Height = math.Max(0, state.Ball.Height*0.75)
	state.Ball.VX *= 0.9
	state.Ball.VY *= 0.9
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
		})
	}

	payload := events.TickPayload{
		Type:      "match_tick",
		MatchID:   state.MatchID,
		Tick:      tick,
		ElapsedMS: state.Elapsed.Milliseconds(),
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
		Players: players,
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
				best = &passDecision{
					target:       mate,
					isLob:        isLob,
					success:      success,
					targetX:      mate.X,
					targetY:      mate.Y,
					initialSpeed: e.passBallSpeed(dist, isLob),
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
	pressurePenalty := pressure * 0.24

	if isLob {
		base += 0.03
	}

	return clamp(base-distancePenalty-lanePenalty-pressurePenalty+spaceBoost+tacticBoost, 0.15, 0.92)
}

func (e *MatchEngine) passBallSpeed(dist float64, isLob bool) float64 {
	if isLob {
		return clamp((0.95+dist*0.014)*e.runtime.PassSpeedScale, 0.82, 2.1)
	}
	return clamp((0.72+dist*0.016)*e.runtime.PassSpeedScale, 0.62, 1.85)
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
	state.Ball.Height = 0
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
