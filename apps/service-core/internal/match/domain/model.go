package domain

import "time"

type TeamStats struct {
	Passes           int `json:"passes"`
	SuccessfulPasses int `json:"successfulPasses"`
	PossessionTicks  int `json:"possessionTicks"`
	Shots            int `json:"shots"`
	ShotsOnTarget    int `json:"shotsOnTarget"`
	Goals            int `json:"goals"`
	Fouls            int `json:"fouls"`
	YellowCards      int `json:"yellowCards"`
	RedCards         int `json:"redCards"`
	Corners          int `json:"corners"`
}

type Scorer struct {
	TeamID     string `json:"teamId"`
	PlayerID   int    `json:"playerId"`
	PlayerName string `json:"playerName,omitempty"`
	Minute     int    `json:"minute"`
}

type StartInput struct {
	UserID       uint64
	AwayClubName string
	Mode         string
	StageNo      int
}

type MatchStart struct {
	MatchID      string    `json:"matchId"`
	HomeClubName string    `json:"homeClubName"`
	AwayClubName string    `json:"awayClubName"`
	Mode         string    `json:"mode"`
	StageNo      int       `json:"stageNo,omitempty"`
	StartedAt    time.Time `json:"startedAt"`
}

type FinalizeInput struct {
	UserID    uint64
	MatchID   string
	HomeScore int
	AwayScore int
	HomeStats TeamStats
	AwayStats TeamStats
	Scorers   []Scorer
}

type MatchResult struct {
	MatchID      string    `json:"matchId"`
	HomeClubName string    `json:"homeClubName"`
	AwayClubName string    `json:"awayClubName"`
	HomeScore    int       `json:"homeScore"`
	AwayScore    int       `json:"awayScore"`
	StartedAt    time.Time `json:"startedAt"`
	EndedAt      time.Time `json:"endedAt"`
	HomeStats    TeamStats `json:"homeStats"`
	AwayStats    TeamStats `json:"awayStats"`
	Scorers      []Scorer  `json:"scorers"`
}
