package events

type MatchEvent struct {
	Kind     string `json:"kind"`
	TeamID   string `json:"teamId,omitempty"`
	PlayerID int    `json:"playerId,omitempty"`
	Message  string `json:"message,omitempty"`
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
	OwnerTeamID string  `json:"ownerTeamId,omitempty"`
	OwnerID     int     `json:"ownerId,omitempty"`
}

type ScoreSnapshot struct {
	Home int `json:"home"`
	Away int `json:"away"`
}

type TickPayload struct {
	Type      string           `json:"type"`
	MatchID   string           `json:"matchId"`
	Tick      int              `json:"tick"`
	ElapsedMS int64            `json:"elapsedMs"`
	Score     ScoreSnapshot    `json:"score"`
	Ball      BallSnapshot     `json:"ball"`
	Players   []PlayerSnapshot `json:"players"`
	Events    []MatchEvent     `json:"events"`
}
