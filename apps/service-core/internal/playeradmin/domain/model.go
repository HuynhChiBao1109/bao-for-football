package domain

import "time"

type Player struct {
	ID             int64             `json:"id"`
	Name           string            `json:"name"`
	CountryID      int64             `json:"countryId"`
	ClubID         int64             `json:"clubId"`
	Country        Country           `json:"country"`
	Club           Club              `json:"club"`
	Avatar         *string           `json:"avatar"`
	BaseClub       string            `json:"baseClub"`
	Season         string            `json:"season"`
	SourceType     string            `json:"sourceType"`
	SpecialSkill   string            `json:"specialSkill"`
	Skills         []SpecialSkill    `json:"skills"`
	Positions      []PositionProfile `json:"positions,omitempty"`
	Shooting       int               `json:"shooting"`
	Passing        int               `json:"passing"`
	LongPass       int               `json:"longPass"`
	Vision         int               `json:"vision"`
	GKReach        int               `json:"gkReach"`
	AttAwareness   int               `json:"attackingAwareness"`
	DefAwareness   int               `json:"defensiveAwareness"`
	GKParrying     int               `json:"gkParrying"`
	GKReflex       int               `json:"gkReflex"`
	Duels          int               `json:"duels"`
	Pace           int               `json:"pace"`
	Stamina        int               `json:"stamina"`
	Balance        int               `json:"balance"`
	Technique      int               `json:"technique"`
	Determination  int               `json:"determination"`
	Strength       int               `json:"strength"`
	StandingTackle int               `json:"standingTackle"`
	SlidingTackle  int               `json:"slidingTackle"`
	Dribbling      int               `json:"dribbling"`
	Curve          int               `json:"curve"`
	CreatedAt      time.Time         `json:"createdAt"`
}

type PositionProfile struct {
	Position string  `json:"position"`
	Effect   float64 `json:"effect"`
}

type SpecialSkill struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	IconURL   string    `json:"iconUrl"`
	BuffType  string    `json:"buffType"`
	BuffValue int       `json:"buffValue"`
	CreatedAt time.Time `json:"createdAt"`
}

type Country struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
	Flag string `json:"flag"`
}

type Club struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Logo       string  `json:"logo"`
	CountryID  *int64  `json:"countryId,omitempty"`
	Country    Country `json:"country"`
	Budget     int64   `json:"budget"`
	LeagueID   *int64  `json:"leagueId,omitempty"`
	League     *League `json:"league,omitempty"`
	LeagueName string  `json:"leagueName,omitempty"`
}

type League struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	CountryID *int64  `json:"countryId,omitempty"`
	Country   Country `json:"country"`
	Logo      string  `json:"logo"`
}

type PlayerFilter struct {
	Name      string
	CountryID *int64
	BaseClub  string
}
