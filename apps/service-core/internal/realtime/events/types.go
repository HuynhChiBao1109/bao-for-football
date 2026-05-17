package events

type MatchEvent struct {
	Kind          string  `json:"kind"`
	TeamID        string  `json:"teamId,omitempty"`
	PlayerID      int     `json:"playerId,omitempty"`
	Message       string  `json:"message,omitempty"`
	PassType      string  `json:"passType,omitempty"`
	SuccessPct    int     `json:"successPct,omitempty"`
	ReceiverID    int     `json:"receiverId,omitempty"`
	InterceptorID int     `json:"interceptorId,omitempty"`
	ShotPower     float64 `json:"shotPower,omitempty"`
	ShotOnTarget  bool    `json:"shotOnTarget,omitempty"`
}

type PlayerSnapshot struct {
	ID      int     `json:"id"`
	TeamID  string  `json:"teamId"`
	Role    string  `json:"role"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	HasBall bool    `json:"hasBall"`
}

type BallSnapshot struct {
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	VX          float64 `json:"vx,omitempty"`
	VY          float64 `json:"vy,omitempty"`
	Height      float64 `json:"height,omitempty"`
	InFlight    bool    `json:"inFlight,omitempty"`
	OwnerTeamID string  `json:"ownerTeamId,omitempty"`
	OwnerID     int     `json:"ownerId,omitempty"`
}

type GameplayDebugSnapshot struct {
	Mode               string  `json:"mode,omitempty"`
	PassSpeedScale     float64 `json:"passSpeedScale,omitempty"`
	InterceptionRadius float64 `json:"interceptionRadius,omitempty"`
	GKBuildUpBias      float64 `json:"gkBuildUpBias,omitempty"`
	TempoScale         float64 `json:"tempoScale,omitempty"`
}

type PassPreviewSnapshot struct {
	FromX       float64 `json:"fromX"`
	FromY       float64 `json:"fromY"`
	ToX         float64 `json:"toX"`
	ToY         float64 `json:"toY"`
	PassType    string  `json:"passType,omitempty"`
	SuccessPct  int     `json:"successPct,omitempty"`
	ReceiverID  int     `json:"receiverId,omitempty"`
	HasLaneRisk bool    `json:"hasLaneRisk,omitempty"`
	LaneRiskX   float64 `json:"laneRiskX,omitempty"`
	LaneRiskY   float64 `json:"laneRiskY,omitempty"`
}

type DebugSnapshot struct {
	Gameplay    GameplayDebugSnapshot `json:"gameplay"`
	PassPreview *PassPreviewSnapshot  `json:"passPreview,omitempty"`
}

type ScoreSnapshot struct {
	Home int `json:"home"`
	Away int `json:"away"`
}

type TickPayload struct {
	Type      string           `json:"type"`
	MatchID   string           `json:"matchId"`
	Replay    bool             `json:"replay,omitempty"`
	Tick      int              `json:"tick"`
	ElapsedMS int64            `json:"elapsedMs"`
	Score     ScoreSnapshot    `json:"score"`
	Ball      BallSnapshot     `json:"ball"`
	Players   []PlayerSnapshot `json:"players"`
	Events    []MatchEvent     `json:"events"`
	Debug     DebugSnapshot    `json:"debug"`
}
