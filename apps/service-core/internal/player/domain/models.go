package domain

import "time"

type Stats struct {
	Shooting       int
	Passing        int
	Pace           int
	Physical       int
	Defending      int
	StandingTackle int
	SlidingTackle  int
	Dribbling      int
}

func (s Stats) OverallAverage() float64 {
	total := s.Shooting + s.Passing + s.Pace + s.Physical + s.Defending + s.StandingTackle + s.SlidingTackle + s.Dribbling
	return float64(total) / 8.0
}

func CalculateTotalStats(base Stats, bonus Stats) (Stats, float64) {
	total := Stats{
		Shooting:       base.Shooting + bonus.Shooting,
		Passing:        base.Passing + bonus.Passing,
		Pace:           base.Pace + bonus.Pace,
		Physical:       base.Physical + bonus.Physical,
		Defending:      base.Defending + bonus.Defending,
		StandingTackle: base.StandingTackle + bonus.StandingTackle,
		SlidingTackle:  base.SlidingTackle + bonus.SlidingTackle,
		Dribbling:      base.Dribbling + bonus.Dribbling,
	}

	return total, total.OverallAverage()
}

type User struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Username     string    `gorm:"type:varchar(50);uniqueIndex;not null;column:username"`
	PasswordHash string    `gorm:"type:varchar(255);not null;column:password_hash"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`

	Team        Team         `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	UserPlayers []UserPlayer `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	GachaLogs   []GachaLog   `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

func (User) TableName() string {
	return "users"
}

type Team struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	UserID    uint64    `gorm:"not null;uniqueIndex;column:user_id"`
	ClubName  string    `gorm:"type:varchar(100);not null;column:club_name"`
	Image     string    `gorm:"type:varchar(500);not null;default:'';column:image"`
	Budget    int64     `gorm:"not null;default:360000000;column:budget"`
	RankPoint int       `gorm:"not null;default:0;column:rank_point"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (Team) TableName() string {
	return "teams"
}

type PlayerTemplate struct {
	ID                 uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name               string    `gorm:"type:varchar(120);not null;index:idx_player_templates_name;column:name"`
	HeightCM           uint16    `gorm:"not null;column:height_cm"`
	Nationality        string    `gorm:"type:varchar(80);not null;column:nationality"`
	BaseClub           string    `gorm:"type:varchar(120);not null;column:base_club"`
	Season             string    `gorm:"type:enum('Normal','Special');not null;default:Normal;index:idx_player_templates_season;column:season"`
	ImageURL           string    `gorm:"type:varchar(500);column:image_url"`
	BaseShooting       int       `gorm:"not null;default:1;column:base_shooting"`
	BasePassing        int       `gorm:"not null;default:1;column:base_passing"`
	BaseLongPass       int       `gorm:"not null;default:1;column:base_long_pass"`
	BaseVision         int       `gorm:"not null;default:1;column:base_vision"`
	BaseGKReach        int       `gorm:"not null;default:1;column:base_gk_reach"`
	BaseGKParrying     int       `gorm:"not null;default:1;column:base_gk_parrying"`
	BaseGKReflex       int       `gorm:"not null;default:1;column:base_gk_reflex"`
	BaseGKCatching     int       `gorm:"not null;default:1;column:base_gk_catching"`
	BasePace           int       `gorm:"not null;default:1;column:base_pace"`
	BasePhysical       int       `gorm:"not null;default:1;column:base_physical"`
	BaseDefending      int       `gorm:"not null;default:1;column:base_defending"`
	BaseStandingTackle int       `gorm:"not null;default:1;column:base_standing_tackle"`
	BaseSlidingTackle  int       `gorm:"not null;default:1;column:base_sliding_tackle"`
	BaseDribbling      int       `gorm:"not null;default:1;column:base_dribbling"`
	CreatedAt          time.Time `gorm:"column:created_at"`
	UpdatedAt          time.Time `gorm:"column:updated_at"`
}

func (PlayerTemplate) TableName() string {
	return "player_templates"
}

func (p PlayerTemplate) BaseStats() Stats {
	return Stats{
		Shooting:       p.BaseShooting,
		Passing:        p.BasePassing,
		Pace:           p.BasePace,
		Physical:       p.BasePhysical,
		Defending:      p.BaseDefending,
		StandingTackle: p.BaseStandingTackle,
		SlidingTackle:  p.BaseSlidingTackle,
		Dribbling:      p.BaseDribbling,
	}
}

type UserPlayer struct {
	ID                  uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	UserID              uint64    `gorm:"not null;index:idx_user_players_user_id;column:user_id"`
	PlayerTemplateID    uint64    `gorm:"not null;index:idx_user_players_template_id;column:player_template_id"`
	Level               uint8     `gorm:"not null;default:1;check:level_between_1_36,level BETWEEN 1 AND 36;column:level"`
	Exp                 uint32    `gorm:"not null;default:0;column:exp"`
	CurrentPoints       uint32    `gorm:"not null;default:0;column:current_points"`
	BonusShooting       int       `gorm:"not null;default:0;column:bonus_shooting"`
	BonusPassing        int       `gorm:"not null;default:0;column:bonus_passing"`
	BonusLongPass       int       `gorm:"not null;default:0;column:bonus_long_pass"`
	BonusVision         int       `gorm:"not null;default:0;column:bonus_vision"`
	BonusGKReach        int       `gorm:"not null;default:0;column:bonus_gk_reach"`
	BonusGKParrying     int       `gorm:"not null;default:0;column:bonus_gk_parrying"`
	BonusGKReflex       int       `gorm:"not null;default:0;column:bonus_gk_reflex"`
	BonusGKCatching     int       `gorm:"not null;default:0;column:bonus_gk_catching"`
	BonusPace           int       `gorm:"not null;default:0;column:bonus_pace"`
	BonusPhysical       int       `gorm:"not null;default:0;column:bonus_physical"`
	BonusDefending      int       `gorm:"not null;default:0;column:bonus_defending"`
	BonusStandingTackle int       `gorm:"not null;default:0;column:bonus_standing_tackle"`
	BonusSlidingTackle  int       `gorm:"not null;default:0;column:bonus_sliding_tackle"`
	BonusDribbling      int       `gorm:"not null;default:0;column:bonus_dribbling"`
	ObtainedAt          time.Time `gorm:"column:obtained_at"`
	CreatedAt           time.Time `gorm:"column:created_at"`
	UpdatedAt           time.Time `gorm:"column:updated_at"`

	Template PlayerTemplate `gorm:"foreignKey:PlayerTemplateID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (UserPlayer) TableName() string {
	return "user_players"
}

func (u UserPlayer) BonusStats() Stats {
	return Stats{
		Shooting:       u.BonusShooting,
		Passing:        u.BonusPassing,
		Pace:           u.BonusPace,
		Physical:       u.BonusPhysical,
		Defending:      u.BonusDefending,
		StandingTackle: u.BonusStandingTackle,
		SlidingTackle:  u.BonusSlidingTackle,
		Dribbling:      u.BonusDribbling,
	}
}

func (u UserPlayer) TotalStats(template PlayerTemplate) (Stats, float64) {
	return CalculateTotalStats(template.BaseStats(), u.BonusStats())
}

type Skill struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name      string    `gorm:"type:varchar(120);not null;uniqueIndex;column:name"`
	IconURL   string    `gorm:"type:varchar(500);column:icon_url"`
	BuffType  string    `gorm:"type:enum('shooting','passing','pace','physical','defending','standingTackle','slidingTackle','dribbling');not null;column:buff_type"`
	BuffValue int       `gorm:"not null;default:1;column:buff_value"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (Skill) TableName() string {
	return "skills"
}

type GachaLog struct {
	ID                           uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	UserID                       uint64    `gorm:"not null;index:idx_gacha_logs_user_id;column:user_id"`
	UserPlayerID                 *uint64   `gorm:"column:user_player_id"`
	BannerCode                   string    `gorm:"type:varchar(50);not null;index:idx_gacha_logs_banner_code;column:banner_code"`
	PullCountSinceLastHighRarity uint32    `gorm:"not null;default:0;column:pull_count_since_last_high_rarity"`
	PityThreshold                uint16    `gorm:"not null;default:60;column:pity_threshold"`
	IsPityTriggered              bool      `gorm:"not null;default:false;column:is_pity_triggered"`
	Rarity                       string    `gorm:"type:enum('N','R','SR','SSR','UR');not null;column:rarity"`
	PulledAt                     time.Time `gorm:"column:pulled_at"`
	CreatedAt                    time.Time `gorm:"column:created_at"`
}

func (GachaLog) TableName() string {
	return "gacha_logs"
}
