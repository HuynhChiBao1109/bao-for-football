package domain

import "time"

type Config struct {
	TeamID    string       `json:"teamId"`
	Formation string       `json:"formation"`
	PassRatio float64      `json:"passRatio"`
	ShotRatio float64      `json:"shotRatio"`
	Pressure  float64      `json:"pressure"`
	Mode      string       `json:"mode,omitempty"`
	Gameplay  Gameplay     `json:"gameplay,omitempty"`
	Lineup    []LineupSlot `json:"lineup,omitempty"`
	Players   []Player     `json:"players,omitempty"`
	UpdatedAt time.Time    `json:"updatedAt"`
}

type LineupSlot struct {
	SlotID       string `json:"slotId"`
	Position     string `json:"position"`
	UserPlayerID uint64 `json:"userPlayerId"`
}

type Gameplay struct {
	PassSpeedScale     float64 `json:"passSpeedScale,omitempty"`
	InterceptionRadius float64 `json:"interceptionRadius,omitempty"`
	GKBuildUpBias      float64 `json:"gkBuildUpBias,omitempty"`
	TempoScale         float64 `json:"tempoScale,omitempty"`
}

type Player struct {
	CardID         uint64 `json:"cardId,omitempty"`
	Pace           int    `json:"pace"`
	Passing        int    `json:"passing"`
	LongPass       int    `json:"longPass"`
	Vision         int    `json:"vision"`
	Shooting       int    `json:"shooting"`
	Defending      int    `json:"defending"`
	StandingTackle int    `json:"standingTackle"`
	SlidingTackle  int    `json:"slidingTackle"`
	Mental         int    `json:"mental"`
}
