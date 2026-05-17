package domain

import "time"

type Player struct {
	ID             int64     `json:"id"`
	Name           string    `json:"name"`
	CountryID      int64     `json:"countryId"`
	Country        Country   `json:"country"`
	Avatar         *string   `json:"avatar"`
	Nationality    string    `json:"nationality"`
	BaseClub       string    `json:"baseClub"`
	Season         string    `json:"season"`
	SourceType     string    `json:"sourceType"`
	SpecialSkill   string    `json:"specialSkill"`
	Shooting       int       `json:"shooting"`
	Passing        int       `json:"passing"`
	LongPass       int       `json:"longPass"`
	Vision         int       `json:"vision"`
	GKReach        int       `json:"gkReach"`
	CtrAwareness   int       `json:"counterAttackAwareness"`
	GKParrying     int       `json:"gkParrying"`
	GKReflex       int       `json:"gkReflex"`
	GKCatching     int       `json:"gkCatching"`
	Duels          int       `json:"duels"`
	Pace           int       `json:"pace"`
	Physical       int       `json:"physical"`
	Defending      int       `json:"defending"`
	StandingTackle int       `json:"standingTackle"`
	SlidingTackle  int       `json:"slidingTackle"`
	Dribbling      int       `json:"dribbling"`
	CreatedAt      time.Time `json:"createdAt"`
}

type Country struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
	Flag string `json:"flag"`
}
