package domain

type CardStats struct {
	Shooting           int `json:"shooting"`
	Passing            int `json:"passing"`
	LongPass           int `json:"longPass"`
	Vision             int `json:"vision"`
	GKReach            int `json:"gkReach"`
	AttackingAwareness int `json:"attackingAwareness"`
	DefensiveAwareness int `json:"defensiveAwareness"`
	GKParrying         int `json:"gkParrying"`
	GKReflex           int `json:"gkReflex"`
	Duels              int `json:"duels"`
	Pace               int `json:"pace"`
	Stamina            int `json:"stamina"`
	Balance            int `json:"balance"`
	Technique          int `json:"technique"`
	Determination      int `json:"determination"`
	Strength           int `json:"strength"`
	StandingTackle     int `json:"standingTackle"`
	SlidingTackle      int `json:"slidingTackle"`
	Dribbling          int `json:"dribbling"`
	Curve              int `json:"curve"`
}

type Country struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
	Flag string `json:"flag"`
}

type PositionProfile struct {
	Position string  `json:"position"`
	Effect   float64 `json:"effect"`
}

type PlayerCard struct {
	UserPlayerID       uint64            `json:"userPlayerId"`
	PlayerTemplateID   uint64            `json:"playerTemplateId"`
	Name               string            `json:"name"`
	ImageURL           string            `json:"imageUrl"`
	ClubImage          string            `json:"clubImage"`
	HeightCM           uint16            `json:"heightCM"`
	BaseClub           string            `json:"baseClub"`
	Season             string            `json:"season"`
	Level              uint8             `json:"level"`
	Exp                uint32            `json:"exp"`
	CurrentPoints      uint32            `json:"currentPoints"`
	RequiredExpForNext uint32            `json:"requiredExpForNextLevel"`
	ExpProgressPercent float64           `json:"expProgressPercent"`
	CanLevelUp         bool              `json:"canLevelUp"`
	Country            Country           `json:"country"`
	BaseStats          CardStats         `json:"baseStats"`
	BonusStats         CardStats         `json:"bonusStats"`
	TotalStats         CardStats         `json:"totalStats"`
	Overall            float64           `json:"overall"`
	Positions          []PositionProfile `json:"positions,omitempty"`
}

type AllocateStatsInput struct {
	Shooting           int `json:"shooting"`
	Passing            int `json:"passing"`
	LongPass           int `json:"longPass"`
	Vision             int `json:"vision"`
	GKReach            int `json:"gkReach"`
	AttackingAwareness int `json:"attackingAwareness"`
	DefensiveAwareness int `json:"defensiveAwareness"`
	GKParrying         int `json:"gkParrying"`
	GKReflex           int `json:"gkReflex"`
	Duels              int `json:"duels"`
	Pace               int `json:"pace"`
	Stamina            int `json:"stamina"`
	Balance            int `json:"balance"`
	Technique          int `json:"technique"`
	Determination      int `json:"determination"`
	Strength           int `json:"strength"`
	StandingTackle     int `json:"standingTackle"`
	SlidingTackle      int `json:"slidingTackle"`
	Dribbling          int `json:"dribbling"`
	Curve              int `json:"curve"`
}
