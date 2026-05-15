package broadcaster

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"strings"
	"sync"
	"time"

	"fifam/apps/service-realtime/internal/events"
	"fifam/apps/service-realtime/internal/hub"
	"fifam/apps/service-realtime/internal/rooms"
)

const (
	tickInterval = 100 * time.Millisecond
	matchLength  = 2 * time.Minute
)

type MatchEngine struct {
	hub      *hub.Hub
	rand     *rand.Rand
	mu       sync.Mutex
	running  bool
	state    *rooms.MatchState
	pending  map[string]UpdateTacticsInput
	bindings map[string]string
}

type UpdateTacticsInput struct {
	TeamID    string
	Formation string
	PassRatio float64
	ShotRatio float64
	Pressure  float64
}

func NewMatchEngine(h *hub.Hub) *MatchEngine {
	return &MatchEngine{
		hub:      h,
		rand:     rand.New(rand.NewSource(time.Now().UnixNano())),
		pending:  make(map[string]UpdateTacticsInput),
		bindings: make(map[string]string),
	}
}

func (e *MatchEngine) EnsureRunning() {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return
	}
	e.running = true
	e.mu.Unlock()

	go e.run()
}

func (e *MatchEngine) run() {
	state := rooms.NewDemoMatchState()
	state.Duration = matchLength

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

	kickoff := events.MatchEvent{Kind: "kickoff", Message: "Match started"}
	e.broadcastTick(state, 0, []events.MatchEvent{kickoff})

	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()

	tick := 0
	maxTicks := int(matchLength / tickInterval)

	for range ticker.C {
		tick++
		e.mu.Lock()
		state.Elapsed += tickInterval
		tickEvents := e.updateState(state)
		e.broadcastTick(state, tick, tickEvents)
		e.mu.Unlock()

		if tick >= maxTicks {
			break
		}
	}

	endEvent := events.MatchEvent{
		Kind:    "match_end",
		Message: fmt.Sprintf("FT %s %d-%d %s", state.HomeTeam.Name, state.HomeTeam.Score, state.AwayTeam.Score, state.AwayTeam.Name),
	}
	e.broadcastTick(state, maxTicks, []events.MatchEvent{endEvent})

	e.mu.Lock()
	e.running = false
	e.state = nil
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

		sideShift := 0.14 + team.Tactics.PassRatio*0.2
		if isNearestChaser || isPressingChaser {
			target = rooms.Vec2{X: state.Ball.X, Y: state.Ball.Y}
		} else if sameTeamAsOwner {
			target = rooms.Vec2{
				X: clamp(p.HomeX+(state.Ball.X-p.HomeX)*sideShift, 0, state.FieldW),
				Y: clamp(p.HomeY+(state.Ball.Y-p.HomeY)*sideShift, 0, state.FieldH),
			}
		}

		if isPossessor {
			goalX := 0.0
			if p.TeamID == state.HomeTeam.ID {
				goalX = state.FieldW
			}
			target = rooms.Vec2{X: goalX, Y: state.FieldH / 2}
		}

		step := paceStep(p.Pace)
		p.X, p.Y = moveTowards(p.X, p.Y, target.X, target.Y, step)
	}

	if state.Ball.OwnerID == 0 {
		e.resolveLooseBall(state, &tickEvents)
	} else {
		e.resolvePossessionPlay(state, &tickEvents)
	}

	e.updateBall(state)

	return tickEvents
}

func (e *MatchEngine) resolveLooseBall(state *rooms.MatchState, tickEvents *[]events.MatchEvent) {
	allPlayers := state.AllPlayers()
	nearest := nearestToBall(allPlayers, state.Ball.X, state.Ball.Y)
	if nearest == nil {
		return
	}

	if distance(nearest.X, nearest.Y, state.Ball.X, state.Ball.Y) < 1.3 {
		state.Ball.OwnerID = nearest.ID
		state.Ball.OwnerTeamID = nearest.TeamID
		nearest.HasBall = true
		*tickEvents = append(*tickEvents, events.MatchEvent{
			Kind:     "possession_change",
			TeamID:   nearest.TeamID,
			PlayerID: nearest.ID,
			Message:  "Recovered possession",
		})
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
		foulProb = clamp(0.004+float64(nearestDef.Defending)/3200.0+opponent.Tactics.Pressing*0.03+opponent.Tactics.Pressure*0.03+closePressure*0.02, 0.01, 0.2)
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
	target := bestPassTarget(owner, team.Players)
	if target == nil {
		return
	}

	passSuccess := clamp(0.45+float64(owner.Passing)/180.0+team.Tactics.Mental*0.08-opponent.Tactics.Pressing*0.06, 0.25, 0.94)
	passSuccess = clamp(passSuccess+team.Tactics.PassRatio*0.08-opponent.Tactics.Pressure*0.06, 0.2, 0.97)
	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "pass", TeamID: owner.TeamID, PlayerID: owner.ID, Message: "Attempted pass"})

	if e.rand.Float64() <= passSuccess {
		owner.HasBall = false
		target.HasBall = true
		state.Ball.OwnerID = target.ID
		state.Ball.OwnerTeamID = target.TeamID
		state.Ball.X = target.X
		state.Ball.Y = target.Y
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "possession_change", TeamID: target.TeamID, PlayerID: target.ID, Message: "Successful pass"})
		return
	}

	owner.HasBall = false
	state.Ball.OwnerID = 0
	state.Ball.OwnerTeamID = ""
	state.Ball.VX = (target.X - owner.X) * 0.22
	state.Ball.VY = (target.Y - owner.Y) * 0.22
}

func (e *MatchEngine) handleShot(state *rooms.MatchState, owner *rooms.Player, opponent *rooms.Team, tickEvents *[]events.MatchEvent) {
	*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "shot", TeamID: owner.TeamID, PlayerID: owner.ID, Message: "Shot attempt"})

	distGoal := distanceToGoal(owner, state)
	defenseBlock := teamDefendingAverage(opponent.Players) / 200.0
	xg := clamp(0.05+float64(owner.Shooting)/170.0+float64(owner.Mental)/500.0-distGoal/110.0-defenseBlock, 0.02, 0.72)
	xg = clamp(xg+ownerTeam(owner.TeamID, state).Tactics.ShotRatio*0.1-opponent.Tactics.Pressure*0.06, 0.02, 0.78)

	isGoal := e.rand.Float64() < xg
	if !isGoal {
		owner.HasBall = false
		state.Ball.OwnerID = 0
		state.Ball.OwnerTeamID = ""
		state.Ball.VX = ownerGoalDirection(owner.TeamID, state) * 1.2
		state.Ball.VY = (e.rand.Float64() - 0.5) * 0.8
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

	e.resetKickoff(state, oppositeTeamID(owner.TeamID, state))
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
		return
	}

	if cardRoll < 0.33 {
		*tickEvents = append(*tickEvents, events.MatchEvent{Kind: "yellow_card", TeamID: defender.TeamID, PlayerID: defender.ID, Message: "Yellow card"})
		defender.Defending = maxInt(defender.Defending-3, 30)
	}
}

func (e *MatchEngine) resetKickoff(state *rooms.MatchState, kickoffTeamID string) {
	for _, p := range state.AllPlayers() {
		p.X = p.HomeX
		p.Y = p.HomeY
		p.HasBall = false
	}

	state.Ball.X = state.FieldW / 2
	state.Ball.Y = state.FieldH / 2
	state.Ball.VX = 0
	state.Ball.VY = 0
	state.Ball.OwnerTeamID = kickoffTeamID

	kickoffPlayer := state.HomeTeam.Players[9]
	if kickoffTeamID == state.AwayTeam.ID {
		kickoffPlayer = state.AwayTeam.Players[9]
	}
	kickoffPlayer.HasBall = true
	state.Ball.OwnerID = kickoffPlayer.ID
}

func (e *MatchEngine) updateBall(state *rooms.MatchState) {
	for _, p := range state.AllPlayers() {
		if p.ID == state.Ball.OwnerID {
			state.Ball.X = clamp(p.X+ownerGoalDirection(p.TeamID, state)*0.35, 0, state.FieldW)
			state.Ball.Y = clamp(p.Y, 0, state.FieldH)
			state.Ball.VX = 0
			state.Ball.VY = 0
			return
		}
	}

	state.Ball.X = clamp(state.Ball.X+state.Ball.VX, 0, state.FieldW)
	state.Ball.Y = clamp(state.Ball.Y+state.Ball.VY, 0, state.FieldH)
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
			OwnerTeamID: state.Ball.OwnerTeamID,
			OwnerID:     state.Ball.OwnerID,
		},
		Players: players,
		Events:  tickEvents,
	}

	bytes, err := json.Marshal(payload)
	if err != nil {
		return
	}
	e.hub.Publish(bytes)
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

func bestPassTarget(owner *rooms.Player, teammates []*rooms.Player) *rooms.Player {
	var best *rooms.Player
	bestScore := -9999.0
	for _, p := range teammates {
		if p.ID == owner.ID {
			continue
		}
		score := math.Abs(p.X-owner.X)*0.6 - math.Abs(p.Y-owner.Y)*0.15 + float64(p.Mental)*0.01
		if score > bestScore {
			bestScore = score
			best = p
		}
	}
	return best
}

func teamDefendingAverage(players []*rooms.Player) float64 {
	if len(players) == 0 {
		return 0
	}
	sum := 0
	for _, p := range players {
		sum += p.Defending
	}
	return float64(sum) / float64(len(players))
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

func paceStep(pace int) float64 {
	return 0.22 + float64(pace)*0.0048
}

func moveTowards(x float64, y float64, tx float64, ty float64, maxStep float64) (float64, float64) {
	dx := tx - x
	dy := ty - y
	d := math.Sqrt(dx*dx + dy*dy)
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
