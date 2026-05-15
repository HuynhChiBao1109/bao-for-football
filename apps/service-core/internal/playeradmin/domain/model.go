package domain

import "time"

type Player struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Nationality  string    `json:"nationality"`
	BaseClub     string    `json:"baseClub"`
	Season       string    `json:"season"`
	SourceType   string    `json:"sourceType"`
	SpecialSkill string    `json:"specialSkill"`
	Shooting     int       `json:"shooting"`
	Passing      int       `json:"passing"`
	Pace         int       `json:"pace"`
	Physical     int       `json:"physical"`
	Defending    int       `json:"defending"`
	Dribbling    int       `json:"dribbling"`
	CreatedAt    time.Time `json:"createdAt"`
}
