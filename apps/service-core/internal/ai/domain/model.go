package domain

import "time"

const TotalStages = 50

type Stage struct {
	StageNo        int       `json:"stageNo"`
	ClubID         int64     `json:"clubId"`
	ClubName       string    `json:"clubName"`
	RewardMoney    int64     `json:"rewardMoney"`
	RewardExp      int       `json:"rewardExp"`
	EnemyStatBonus int       `json:"enemyStatBonus"`
	IsUnlocked     bool      `json:"isUnlocked"`
	IsCleared      bool      `json:"isCleared"`
	Attempts       int       `json:"attempts"`
	Wins           int       `json:"wins"`
	UnlockedAt     time.Time `json:"unlockedAt,omitempty"`
	LastClearedAt  time.Time `json:"lastClearedAt,omitempty"`
	LastUpdatedAt  time.Time `json:"updatedAt,omitempty"`
}

type OpponentPlayer struct {
	Name      string `json:"name"`
	Role      string `json:"role"`
	Shooting  int    `json:"shooting"`
	Passing   int    `json:"passing"`
	Pace      int    `json:"pace"`
	Physical  int    `json:"physical"`
	Defending int    `json:"defending"`
	Dribbling int    `json:"dribbling"`
}

type StageDetail struct {
	Stage    Stage            `json:"stage"`
	Opponent []OpponentPlayer `json:"opponent"`
}

type StageResult struct {
	StageNo           int  `json:"stageNo"`
	IsWin             bool `json:"isWin"`
	IsCleared         bool `json:"isCleared"`
	UnlockedNext      bool `json:"unlockedNext"`
	NextUnlockedStage int  `json:"nextUnlockedStage"`
	GrantedMoney      int64 `json:"grantedMoney"`
	GrantedExpPerPlayer int `json:"grantedExpPerPlayer"`
	RewardedPlayers   int  `json:"rewardedPlayers"`
}
