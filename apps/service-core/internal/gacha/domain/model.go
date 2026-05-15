package domain

type RollResult struct {
	UserID                 uint64 `json:"userId"`
	BannerCode             string `json:"bannerCode"`
	Rarity                 string `json:"rarity"`
	Season                 string `json:"season"`
	IsSpecial              bool   `json:"isSpecial"`
	IsPityTriggered        bool   `json:"isPityTriggered"`
	TotalRolls             int    `json:"totalRolls"`
	RollsSinceLastSpecial  int    `json:"rollsSinceLastSpecial"`
	NextRollGuaranteedHint bool   `json:"nextRollGuaranteedHint"`
}
