package domain

type CardStats struct {
	Shooting  int `json:"shooting"`
	Passing   int `json:"passing"`
	Pace      int `json:"pace"`
	Physical  int `json:"physical"`
	Defending int `json:"defending"`
	Dribbling int `json:"dribbling"`
}

type Country struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
	Flag string `json:"flag"`
}

type PlayerCard struct {
	UserPlayerID       uint64    `json:"userPlayerId"`
	PlayerTemplateID   uint64    `json:"playerTemplateId"`
	Name               string    `json:"name"`
	HeightCM           uint16    `json:"heightCM"`
	BaseClub           string    `json:"baseClub"`
	Season             string    `json:"season"`
	Level              uint8     `json:"level"`
	Exp                uint32    `json:"exp"`
	CurrentPoints      uint32    `json:"currentPoints"`
	RequiredExpForNext uint32    `json:"requiredExpForNextLevel"`
	ExpProgressPercent float64   `json:"expProgressPercent"`
	CanLevelUp         bool      `json:"canLevelUp"`
	Country            Country   `json:"country"`
	BaseStats          CardStats `json:"baseStats"`
	BonusStats         CardStats `json:"bonusStats"`
	TotalStats         CardStats `json:"totalStats"`
	Overall            float64   `json:"overall"`
}

type AllocateStatsInput struct {
	Shooting  int `json:"shooting"`
	Passing   int `json:"passing"`
	Pace      int `json:"pace"`
	Physical  int `json:"physical"`
	Defending int `json:"defending"`
	Dribbling int `json:"dribbling"`
}
