package mysql

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"
)

type migrationClub struct {
	ID         uint64            `gorm:"primaryKey;autoIncrement;column:id"`
	Name       string            `gorm:"type:varchar(120);not null;uniqueIndex:uk_clubs_name;column:name"`
	Logo       string            `gorm:"type:varchar(500);not null;default:'';column:logo"`
	CountryID  *uint64           `gorm:"index:idx_clubs_country_id;column:country_id"`
	Budget     int64             `gorm:"not null;default:0;column:budget"`
	LeagueName string            `gorm:"type:varchar(120);not null;column:league_name"`
	CreatedAt  time.Time         `gorm:"column:created_at"`
	UpdatedAt  time.Time         `gorm:"column:updated_at"`
	Country    *migrationCountry `gorm:"foreignKey:CountryID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (migrationClub) TableName() string {
	return "clubs"
}

type migrationUser struct {
	ID           uint64                `gorm:"primaryKey;autoIncrement;column:id"`
	Username     string                `gorm:"type:varchar(50);not null;uniqueIndex:uk_users_username;column:username"`
	PasswordHash string                `gorm:"type:varchar(255);not null;column:password_hash"`
	CreatedAt    time.Time             `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;column:created_at"`
	UpdatedAt    time.Time             `gorm:"type:timestamp;not null;default:CURRENT_TIMESTAMP;column:updated_at"`
	Team         migrationTeam         `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	UserPlayers  []migrationUserPlayer `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	GachaLogs    []migrationGachaLog   `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

func (migrationUser) TableName() string {
	return "users"
}

type migrationTeam struct {
	ID        uint64         `gorm:"primaryKey;autoIncrement;column:id"`
	UserID    uint64         `gorm:"not null;uniqueIndex:uk_teams_user_id;column:user_id"`
	ClubID    *uint64        `gorm:"index:idx_teams_club_id;column:club_id"`
	ClubName  string         `gorm:"type:varchar(100);not null;column:club_name"`
	Budget    int64          `gorm:"not null;default:0;column:budget"`
	RankPoint int            `gorm:"not null;default:0;column:rank_point"`
	CreatedAt time.Time      `gorm:"column:created_at"`
	UpdatedAt time.Time      `gorm:"column:updated_at"`
	Club      *migrationClub `gorm:"foreignKey:ClubID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (migrationTeam) TableName() string {
	return "teams"
}

type migrationCountry struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name      string    `gorm:"type:varchar(120);not null;uniqueIndex:uk_countries_name;column:name"`
	Code      string    `gorm:"type:varchar(20);column:code"`
	Flag      string    `gorm:"type:varchar(255);column:flag"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (migrationCountry) TableName() string {
	return "countries"
}

type migrationAdminPlayer struct {
	ID             uint64            `gorm:"primaryKey;autoIncrement;column:id"`
	Name           string            `gorm:"type:varchar(120);not null;column:name"`
	CountryID      *uint64           `gorm:"index:idx_admin_players_country_id;column:country_id"`
	Avatar         string            `gorm:"type:varchar(500);column:avatar"`
	Nationality    string            `gorm:"type:varchar(80);not null;column:nationality"`
	BaseClub       string            `gorm:"type:varchar(120);not null;column:base_club"`
	Season         string            `gorm:"type:enum('Normal','Special');not null;default:Normal;index:idx_admin_players_season;column:season"`
	SourceType     string            `gorm:"type:enum('normal','gacha');not null;default:normal;index:idx_admin_players_source_type;column:source_type"`
	SpecialSkill   string            `gorm:"type:varchar(120);not null;default:'';column:special_skill"`
	Shooting       uint8             `gorm:"not null;column:shooting"`
	Passing        uint8             `gorm:"not null;column:passing"`
	LongPass       uint8             `gorm:"not null;default:60;column:long_pass"`
	Vision         uint8             `gorm:"not null;default:60;column:vision"`
	GKReach        uint8             `gorm:"not null;default:60;column:gk_reach"`
	AttAwareness   uint8             `gorm:"not null;default:60;column:counter_attack_awareness"`
	DefAwareness   uint8             `gorm:"not null;default:60;column:defending"`
	GKParrying     uint8             `gorm:"not null;default:60;column:gk_parrying"`
	GKReflex       uint8             `gorm:"not null;default:60;column:gk_reflex"`
	Duels          uint8             `gorm:"not null;default:60;column:duels"`
	Pace           uint8             `gorm:"not null;column:pace"`
	Stamina        uint8             `gorm:"not null;default:60;column:stamina"`
	Balance        uint8             `gorm:"not null;default:60;column:balance"`
	Technique      uint8             `gorm:"not null;default:60;column:technique"`
	Determination  uint8             `gorm:"not null;default:60;column:determination"`
	Strength       uint8             `gorm:"not null;column:physical"`
	StandingTackle uint8             `gorm:"not null;default:60;column:standing_tackle"`
	SlidingTackle  uint8             `gorm:"not null;default:60;column:sliding_tackle"`
	Dribbling      uint8             `gorm:"not null;column:dribbling"`
	Curve          uint8             `gorm:"not null;default:60;column:curve"`
	CreatedAt      time.Time         `gorm:"column:created_at"`
	Country        *migrationCountry `gorm:"foreignKey:CountryID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (migrationAdminPlayer) TableName() string {
	return "admin_players"
}

type migrationPlayerTemplate struct {
	ID                 uint64            `gorm:"primaryKey;autoIncrement;column:id"`
	Name               string            `gorm:"type:varchar(120);not null;index:idx_player_templates_name;column:name"`
	HeightCM           uint16            `gorm:"not null;column:height_cm"`
	CountryID          *uint64           `gorm:"index:idx_player_templates_country_id;column:country_id"`
	Nationality        string            `gorm:"type:varchar(80);not null;column:nationality"`
	BaseClub           string            `gorm:"type:varchar(120);not null;column:base_club"`
	Season             string            `gorm:"type:enum('Normal','Special');not null;default:Normal;index:idx_player_templates_season;column:season"`
	ImageURL           string            `gorm:"type:varchar(500);column:image_url"`
	BaseShooting       int               `gorm:"not null;default:1;column:base_shooting"`
	BasePassing        int               `gorm:"not null;default:1;column:base_passing"`
	BaseLongPass       int               `gorm:"not null;default:1;column:base_long_pass"`
	BaseVision         int               `gorm:"not null;default:1;column:base_vision"`
	BaseGKReach        int               `gorm:"not null;default:1;column:base_gk_reach"`
	BaseAttAware       int               `gorm:"not null;default:1;column:base_counter_attack_awareness"`
	BaseDefAware       int               `gorm:"not null;default:1;column:base_defending"`
	BaseGKParrying     int               `gorm:"not null;default:1;column:base_gk_parrying"`
	BaseGKReflex       int               `gorm:"not null;default:1;column:base_gk_reflex"`
	BaseDuels          int               `gorm:"not null;default:1;column:base_duels"`
	BasePace           int               `gorm:"not null;default:1;column:base_pace"`
	BaseStamina        int               `gorm:"not null;default:1;column:base_stamina"`
	BaseBalance        int               `gorm:"not null;default:1;column:base_balance"`
	BaseTechnique      int               `gorm:"not null;default:1;column:base_technique"`
	BaseDetermination  int               `gorm:"not null;default:1;column:base_determination"`
	BaseStrength       int               `gorm:"not null;default:1;column:base_physical"`
	BaseStandingTackle int               `gorm:"not null;default:1;column:base_standing_tackle"`
	BaseSlidingTackle  int               `gorm:"not null;default:1;column:base_sliding_tackle"`
	BaseDribbling      int               `gorm:"not null;default:1;column:base_dribbling"`
	BaseCurve          int               `gorm:"not null;default:1;column:base_curve"`
	CreatedAt          time.Time         `gorm:"column:created_at"`
	UpdatedAt          time.Time         `gorm:"column:updated_at"`
	Country            *migrationCountry `gorm:"foreignKey:CountryID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (migrationPlayerTemplate) TableName() string {
	return "player_templates"
}

type migrationUserPlayer struct {
	ID                  uint64                  `gorm:"primaryKey;autoIncrement;column:id"`
	UserID              uint64                  `gorm:"not null;index:idx_user_players_user_id;column:user_id"`
	PlayerTemplateID    uint64                  `gorm:"not null;index:idx_user_players_template_id;column:player_template_id"`
	Level               uint8                   `gorm:"not null;default:1;check:ck_user_players_level,level BETWEEN 1 AND 36;column:level"`
	Exp                 uint32                  `gorm:"not null;default:0;column:exp"`
	CurrentPoints       uint32                  `gorm:"not null;default:0;column:current_points"`
	BonusShooting       int                     `gorm:"not null;default:0;column:bonus_shooting"`
	BonusPassing        int                     `gorm:"not null;default:0;column:bonus_passing"`
	BonusLongPass       int                     `gorm:"not null;default:0;column:bonus_long_pass"`
	BonusVision         int                     `gorm:"not null;default:0;column:bonus_vision"`
	BonusGKReach        int                     `gorm:"not null;default:0;column:bonus_gk_reach"`
	BonusAttAware       int                     `gorm:"not null;default:0;column:bonus_counter_attack_awareness"`
	BonusDefAware       int                     `gorm:"not null;default:0;column:bonus_defending"`
	BonusGKParrying     int                     `gorm:"not null;default:0;column:bonus_gk_parrying"`
	BonusGKReflex       int                     `gorm:"not null;default:0;column:bonus_gk_reflex"`
	BonusDuels          int                     `gorm:"not null;default:0;column:bonus_duels"`
	BonusPace           int                     `gorm:"not null;default:0;column:bonus_pace"`
	BonusStamina        int                     `gorm:"not null;default:0;column:bonus_stamina"`
	BonusBalance        int                     `gorm:"not null;default:0;column:bonus_balance"`
	BonusTechnique      int                     `gorm:"not null;default:0;column:bonus_technique"`
	BonusDetermination  int                     `gorm:"not null;default:0;column:bonus_determination"`
	BonusStrength       int                     `gorm:"not null;default:0;column:bonus_physical"`
	BonusStandingTackle int                     `gorm:"not null;default:0;column:bonus_standing_tackle"`
	BonusSlidingTackle  int                     `gorm:"not null;default:0;column:bonus_sliding_tackle"`
	BonusDribbling      int                     `gorm:"not null;default:0;column:bonus_dribbling"`
	BonusCurve          int                     `gorm:"not null;default:0;column:bonus_curve"`
	ObtainedAt          time.Time               `gorm:"column:obtained_at"`
	CreatedAt           time.Time               `gorm:"column:created_at"`
	UpdatedAt           time.Time               `gorm:"column:updated_at"`
	Template            migrationPlayerTemplate `gorm:"foreignKey:PlayerTemplateID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (migrationUserPlayer) TableName() string {
	return "user_players"
}

type migrationSkill struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name      string    `gorm:"type:varchar(120);not null;uniqueIndex:uk_skills_name;column:name"`
	IconURL   string    `gorm:"type:varchar(500);column:icon_url"`
	BuffType  string    `gorm:"type:enum('shooting','passing','longPass','vision','gkReach','attackingAwareness','defensiveAwareness','gkParrying','gkReflex','duels','standingTackle','slidingTackle','pace','stamina','balance','technique','determination','strength','dribbling','curve');not null;column:buff_type"`
	BuffValue int       `gorm:"not null;default:1;column:buff_value"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (migrationSkill) TableName() string {
	return "skills"
}

type migrationAdminPlayerSkill struct {
	ID       uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	PlayerID uint64    `gorm:"not null;index:idx_admin_player_skills_player_id;uniqueIndex:uk_admin_player_skills_player_skill,priority:1;column:player_id"`
	SkillID  uint64    `gorm:"not null;index:idx_admin_player_skills_skill_id;uniqueIndex:uk_admin_player_skills_player_skill,priority:2;column:skill_id"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (migrationAdminPlayerSkill) TableName() string {
	return "admin_player_skills"
}

type migrationGachaLog struct {
	ID                           uint64               `gorm:"primaryKey;autoIncrement;column:id"`
	UserID                       uint64               `gorm:"not null;index:idx_gacha_logs_user_id;column:user_id"`
	UserPlayerID                 *uint64              `gorm:"column:user_player_id"`
	BannerCode                   string               `gorm:"type:varchar(50);not null;index:idx_gacha_logs_banner_code;column:banner_code"`
	PullCountSinceLastHighRarity uint32               `gorm:"not null;default:0;column:pull_count_since_last_high_rarity"`
	PityThreshold                uint16               `gorm:"not null;default:60;column:pity_threshold"`
	IsPityTriggered              bool                 `gorm:"not null;default:false;column:is_pity_triggered"`
	Rarity                       string               `gorm:"type:enum('N','R','SR','SSR','UR');not null;column:rarity"`
	PulledAt                     time.Time            `gorm:"column:pulled_at"`
	CreatedAt                    time.Time            `gorm:"column:created_at"`
	UserPlayer                   *migrationUserPlayer `gorm:"foreignKey:UserPlayerID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
}

func (migrationGachaLog) TableName() string {
	return "gacha_logs"
}

type migrationAdminGachaBanner struct {
	ID              uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	BannerCode      string    `gorm:"type:varchar(80);not null;uniqueIndex:uk_admin_gacha_banners_banner_code;column:banner_code"`
	BannerName      string    `gorm:"type:varchar(120);not null;column:banner_name"`
	BannerImageData string    `gorm:"type:longtext;not null;column:banner_image_data"`
	PlayerID        int64     `gorm:"not null;index:idx_admin_gacha_banners_player_id;column:player_id"`
	CreatedAt       time.Time `gorm:"column:created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at"`
}

func (migrationAdminGachaBanner) TableName() string {
	return "admin_gacha_banners"
}

type migrationTeamTactics struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	TeamID    string    `gorm:"type:varchar(32);not null;uniqueIndex:uk_team_tactics_team_id;column:team_id"`
	Formation string    `gorm:"type:varchar(10);not null;column:formation"`
	PassRatio float64   `gorm:"not null;column:pass_ratio"`
	ShotRatio float64   `gorm:"not null;column:shot_ratio"`
	Pressure  float64   `gorm:"not null;column:pressure"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (migrationTeamTactics) TableName() string {
	return "team_tactics"
}

type migrationAIUserStage struct {
	ID             uint64     `gorm:"primaryKey;autoIncrement;column:id"`
	UserID         uint64     `gorm:"not null;uniqueIndex:uk_ai_user_stage,priority:1;index:idx_ai_user_stages_user_id;column:user_id"`
	StageNo        int        `gorm:"not null;uniqueIndex:uk_ai_user_stage,priority:2;column:stage_no"`
	ClubID         uint64     `gorm:"not null;index:idx_ai_user_stages_club_id;column:club_id"`
	ClubName       string     `gorm:"type:varchar(120);not null;column:club_name"`
	RewardMoney    int64      `gorm:"not null;default:0;column:reward_money"`
	RewardExp      int        `gorm:"not null;default:0;column:reward_exp"`
	EnemyStatBonus int        `gorm:"not null;default:0;column:enemy_stat_bonus"`
	IsUnlocked     bool       `gorm:"not null;default:false;column:is_unlocked"`
	IsCleared      bool       `gorm:"not null;default:false;column:is_cleared"`
	Attempts       int        `gorm:"not null;default:0;column:attempts"`
	Wins           int        `gorm:"not null;default:0;column:wins"`
	UnlockedAt     *time.Time `gorm:"column:unlocked_at"`
	LastClearedAt  *time.Time `gorm:"column:last_cleared_at"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at"`
}

func (migrationAIUserStage) TableName() string {
	return "ai_user_stages"
}

type migrationMatch struct {
	ID           uint64     `gorm:"primaryKey;autoIncrement;column:id"`
	MatchUUID    string     `gorm:"type:char(36);not null;uniqueIndex:uk_matches_match_uuid;column:match_uuid"`
	UserID       uint64     `gorm:"not null;index:idx_matches_user_id;column:user_id"`
	HomeClubName string     `gorm:"type:varchar(120);not null;column:home_club_name"`
	AwayClubName string     `gorm:"type:varchar(120);not null;column:away_club_name"`
	HomeScore    int        `gorm:"not null;default:0;column:home_score"`
	AwayScore    int        `gorm:"not null;default:0;column:away_score"`
	Mode         string     `gorm:"type:varchar(32);not null;default:casual;column:mode"`
	StageNo      *int       `gorm:"column:stage_no"`
	Status       string     `gorm:"type:enum('running','finished');not null;default:running;column:status"`
	HomeStats    string     `gorm:"type:json;column:home_stats"`
	AwayStats    string     `gorm:"type:json;column:away_stats"`
	StartedAt    time.Time  `gorm:"column:started_at"`
	EndedAt      *time.Time `gorm:"column:ended_at"`
	CreatedAt    time.Time  `gorm:"column:created_at"`
	UpdatedAt    time.Time  `gorm:"column:updated_at"`

	User    migrationUser          `gorm:"foreignKey:UserID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Scorers []migrationMatchScorer `gorm:"foreignKey:MatchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

func (migrationMatch) TableName() string {
	return "matches"
}

type migrationMatchScorer struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	MatchID    uint64    `gorm:"not null;index:idx_match_scorers_match_id;column:match_id"`
	TeamSide   string    `gorm:"type:enum('home','away');not null;column:team_side"`
	PlayerID   int       `gorm:"not null;column:player_id"`
	PlayerName string    `gorm:"type:varchar(120);column:player_name"`
	Minute     int       `gorm:"not null;default:0;column:minute"`
	CreatedAt  time.Time `gorm:"column:created_at"`
}

func (migrationMatchScorer) TableName() string {
	return "match_scorers"
}

type defaultClub struct {
	ID          int64
	Name        string
	Logo        string
	CountryName string
	CountryCode string
	Budget      int64
	LeagueName  string
}

var fallbackSeededClubs = []defaultClub{
	{ID: 1, Name: "Manchester United", Logo: "https://media.api-sports.io/football/teams/33.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 120000000, LeagueName: "Premier League"},
	{ID: 2, Name: "Manchester City", Logo: "https://media.api-sports.io/football/teams/50.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 118000000, LeagueName: "Premier League"},
	{ID: 3, Name: "Liverpool", Logo: "https://media.api-sports.io/football/teams/40.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 116000000, LeagueName: "Premier League"},
	{ID: 4, Name: "Chelsea", Logo: "https://media.api-sports.io/football/teams/49.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 114000000, LeagueName: "Premier League"},
	{ID: 5, Name: "Arsenal", Logo: "https://media.api-sports.io/football/teams/42.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 112000000, LeagueName: "Premier League"},
	{ID: 6, Name: "Tottenham Hotspur", Logo: "https://media.api-sports.io/football/teams/47.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 110000000, LeagueName: "Premier League"},
	{ID: 7, Name: "Newcastle United", Logo: "https://media.api-sports.io/football/teams/34.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 108000000, LeagueName: "Premier League"},
	{ID: 8, Name: "Aston Villa", Logo: "https://media.api-sports.io/football/teams/66.png", CountryName: "England", CountryCode: "GB-ENG", Budget: 106000000, LeagueName: "Premier League"},
}

type defaultCountry struct {
	Name string
	Code string
	Flag string
}

var seededCountries = []defaultCountry{
	{Name: "Vietnam", Code: "VN", Flag: "https://media.api-sports.io/flags/vn.svg"},
	{Name: "Brazil", Code: "BR", Flag: "https://media.api-sports.io/flags/br.svg"},
	{Name: "Argentina", Code: "AR", Flag: "https://media.api-sports.io/flags/ar.svg"},
	{Name: "Spain", Code: "ES", Flag: "https://media.api-sports.io/flags/es.svg"},
	{Name: "France", Code: "FR", Flag: "https://media.api-sports.io/flags/fr.svg"},
	{Name: "Germany", Code: "DE", Flag: "https://media.api-sports.io/flags/de.svg"},
	{Name: "Portugal", Code: "PT", Flag: "https://media.api-sports.io/flags/pt.svg"},
	{Name: "England", Code: "GB-ENG", Flag: "https://media.api-sports.io/flags/gb-eng.svg"},
	{Name: "Italy", Code: "IT", Flag: "https://media.api-sports.io/flags/it.svg"},
	{Name: "Netherlands", Code: "NL", Flag: "https://media.api-sports.io/flags/nl.svg"},
	{Name: "Japan", Code: "JP", Flag: "https://media.api-sports.io/flags/jp.svg"},
	{Name: "South-Korea", Code: "KR", Flag: "https://media.api-sports.io/flags/kr.svg"},
}

func AutoMigrate(ctx context.Context, db *gorm.DB) error {
	if db == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	if err := ensureGoalkeeperColumnRenames(ctx, sqlDB); err != nil {
		return err
	}

	if err := ensureClubSchema(ctx, sqlDB); err != nil {
		return err
	}

	if err := db.WithContext(ctx).Set("gorm:table_options", "ENGINE=InnoDB").AutoMigrate(
		&migrationClub{},
		&migrationCountry{},
		&migrationAdminPlayer{},
		&migrationPlayerTemplate{},
		&migrationSkill{},
		&migrationAdminPlayerSkill{},
		&migrationUser{},
		&migrationTeam{},
		&migrationUserPlayer{},
		&migrationGachaLog{},
		&migrationAdminGachaBanner{},
		&migrationTeamTactics{},
		&migrationAIUserStage{},
		&migrationMatch{},
		&migrationMatchScorer{},
	); err != nil {
		return err
	}

	if err := ensureClubSchema(ctx, sqlDB); err != nil {
		return err
	}

	return ensureTriggers(ctx, sqlDB)
}

func EnsureSeedData(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	if err := ensureCountries(ctx, db); err != nil {
		return fmt.Errorf("ensureCountries: %w", err)
	}
	if err := ensureDefaultClubs(ctx, db); err != nil {
		return fmt.Errorf("ensureDefaultClubs: %w", err)
	}
	if err := backfillCountryRelations(ctx, db); err != nil {
		return fmt.Errorf("backfillCountryRelations: %w", err)
	}
	if err := ensureDefaultPlayers(ctx, db); err != nil {
		return fmt.Errorf("ensureDefaultPlayers: %w", err)
	}

	return nil
}

func ensureTriggers(ctx context.Context, db *sql.DB) error {
	triggers := []struct {
		name  string
		query string
	}{
		{
			name: "trg_user_players_limit_before_insert",
			query: `CREATE TRIGGER trg_user_players_limit_before_insert
BEFORE INSERT ON user_players
FOR EACH ROW
BEGIN
  DECLARE owned_count INT;

  SELECT COUNT(*) INTO owned_count
  FROM user_players
  WHERE user_id = NEW.user_id;

  IF owned_count >= 50 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'User cannot own more than 50 player cards';
  END IF;
END`,
		},
	}

	for _, item := range triggers {
		exists, err := hasTrigger(ctx, db, item.name)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		if _, err := db.ExecContext(ctx, item.query); err != nil {
			return err
		}
	}

	return nil
}

func hasTrigger(ctx context.Context, db *sql.DB, triggerName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.TRIGGERS
WHERE TRIGGER_SCHEMA = DATABASE()
	AND TRIGGER_NAME = ?`, triggerName).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func ensureGoalkeeperColumnRenames(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return nil
	}

	for _, item := range []struct {
		table      string
		oldColumn  string
		newColumn  string
		definition string
	}{
		{"admin_players", "defensive_awareness", "gk_reach", "TINYINT UNSIGNED NOT NULL DEFAULT 60"},
		{"admin_players", "crossbar_handling", "gk_parrying", "TINYINT UNSIGNED NOT NULL DEFAULT 60"},
		{"admin_players", "reflexes", "gk_reflex", "TINYINT UNSIGNED NOT NULL DEFAULT 60"},
		{"admin_players", "aerial_catching", "gk_catching", "TINYINT UNSIGNED NOT NULL DEFAULT 60"},
		{"player_templates", "base_defensive_awareness", "base_gk_reach", "INT NOT NULL DEFAULT 1"},
		{"player_templates", "base_crossbar_handling", "base_gk_parrying", "INT NOT NULL DEFAULT 1"},
		{"player_templates", "base_reflexes", "base_gk_reflex", "INT NOT NULL DEFAULT 1"},
		{"player_templates", "base_aerial_catching", "base_gk_catching", "INT NOT NULL DEFAULT 1"},
		{"user_players", "bonus_defensive_awareness", "bonus_gk_reach", "INT NOT NULL DEFAULT 0"},
		{"user_players", "bonus_crossbar_handling", "bonus_gk_parrying", "INT NOT NULL DEFAULT 0"},
		{"user_players", "bonus_reflexes", "bonus_gk_reflex", "INT NOT NULL DEFAULT 0"},
		{"user_players", "bonus_aerial_catching", "bonus_gk_catching", "INT NOT NULL DEFAULT 0"},
	} {
		if err := renameColumnIfExists(ctx, db, item.table, item.oldColumn, item.newColumn, item.definition); err != nil {
			return err
		}
	}

	return nil
}

func renameColumnIfExists(ctx context.Context, db *sql.DB, table string, oldColumn string, newColumn string, definition string) error {
	if table == "" || oldColumn == "" || newColumn == "" || definition == "" {
		return nil
	}

	newExists, err := hasColumn(ctx, db, table, newColumn)
	if err != nil {
		return err
	}
	if newExists {
		return nil
	}

	oldExists, err := hasColumn(ctx, db, table, oldColumn)
	if err != nil {
		return err
	}
	if !oldExists {
		return nil
	}

	query := fmt.Sprintf("ALTER TABLE %s CHANGE COLUMN %s %s %s", table, oldColumn, newColumn, definition)
	_, err = db.ExecContext(ctx, query)
	return err
}

func hasColumn(ctx context.Context, db *sql.DB, tableName string, columnName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = ?
  AND column_name = ?`, tableName, columnName).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func ensureClubSchema(ctx context.Context, db *sql.DB) error {
	logoExists, err := hasColumn(ctx, db, "clubs", "logo")
	if err != nil {
		return err
	}
	if !logoExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE clubs ADD COLUMN logo varchar(500) NOT NULL DEFAULT '' AFTER name`); err != nil {
			return err
		}
	}

	countryExists, err := hasColumn(ctx, db, "clubs", "country_id")
	if err != nil {
		return err
	}
	if !countryExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE clubs ADD COLUMN country_id bigint unsigned NULL AFTER logo`); err != nil {
			return err
		}
	}

	formationExists, err := hasColumn(ctx, db, "clubs", "formation")
	if err != nil {
		return err
	}
	if formationExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE clubs DROP COLUMN formation`); err != nil {
			return err
		}
	}

	return nil
}

func ensureDefaultClubs(ctx context.Context, db *sql.DB) error {
	clubs, err := loadSeededClubs()
	if err != nil {
		return err
	}

	for _, club := range clubs {
		countryID, err := resolveCountryID(ctx, db, club.CountryName, club.CountryCode)
		if err != nil {
			return err
		}

		_, err = db.ExecContext(ctx, `
INSERT IGNORE INTO clubs (id, name, logo, country_id, budget, league_name)
VALUES (?, ?, ?, ?, ?, ?)`,
			club.ID,
			club.Name,
			club.Logo,
			countryID,
			club.Budget,
			club.LeagueName,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func ensureCountries(ctx context.Context, db *sql.DB) error {
	countries, err := loadSeededCountries()
	if err != nil {
		return err
	}

	for _, country := range countries {
		_, err := db.ExecContext(ctx, `
INSERT IGNORE INTO countries (name, code, flag)
VALUES (?, ?, ?)`,
			country.Name,
			country.Code,
			country.Flag,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func backfillCountryRelations(ctx context.Context, db *sql.DB) error {
	if _, err := db.ExecContext(ctx, `
UPDATE admin_players ap
INNER JOIN countries c ON c.name = ap.nationality
SET ap.country_id = c.id
WHERE ap.country_id IS NULL`); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, `
UPDATE player_templates pt
INNER JOIN countries c ON c.name = pt.nationality
SET pt.country_id = c.id
WHERE pt.country_id IS NULL`); err != nil {
		return err
	}

	return nil
}

func ensureDefaultPlayers(ctx context.Context, db *sql.DB) error {
	clubs, err := loadSeededClubs()
	if err != nil {
		return err
	}

	for clubIndex, club := range clubs {
		var existingCount int
		err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM admin_players
WHERE source_type = 'normal' AND base_club = ?`, club.Name).Scan(&existingCount)
		if err != nil {
			return err
		}
		if existingCount >= 22 {
			continue
		}

		for i := existingCount + 1; i <= 22; i++ {
			globalIdx := clubIndex*22 + i
			name := fmt.Sprintf("%s Player %02d", club.Name, i)
			country := seededCountries[(globalIdx-1)%len(seededCountries)]
			var countryID int64
			if err := db.QueryRowContext(ctx, `SELECT id FROM countries WHERE name = ? LIMIT 1`, country.Name).Scan(&countryID); err != nil {
				return err
			}
			shooting := boundedStat(60 + (globalIdx % 18))
			passing := boundedStat(58 + ((globalIdx + 3) % 18))
			longPass := boundedStat(57 + ((globalIdx + 5) % 18))
			vision := boundedStat(56 + ((globalIdx + 7) % 18))
			gkReach := boundedStat(55 + ((globalIdx + 4) % 18))
			ctrAwareness := boundedStat(56 + ((globalIdx + 8) % 18))
			gkParrying := boundedStat(54 + ((globalIdx + 10) % 18))
			gkReflex := boundedStat(58 + ((globalIdx + 11) % 18))
			defAwareness := boundedStat(54 + ((globalIdx + 12) % 18))
			duels := boundedStat(59 + ((globalIdx + 14) % 18))
			pace := boundedStat(57 + ((globalIdx + 6) % 18))
			stamina := boundedStat(56 + ((globalIdx + 9) % 18))
			balance := boundedStat(55 + ((globalIdx + 10) % 18))
			technique := boundedStat(57 + ((globalIdx + 11) % 18))
			determination := boundedStat(56 + ((globalIdx + 8) % 18))
			strength := boundedStat(55 + ((globalIdx + 13) % 18))
			standingTackle := boundedStat(56 + ((globalIdx + 16) % 18))
			slidingTackle := boundedStat(55 + ((globalIdx + 17) % 18))
			dribbling := boundedStat(59 + ((globalIdx + 15) % 18))
			curve := boundedStat(56 + ((globalIdx + 5) % 18))

			_, err = db.ExecContext(ctx, `
INSERT INTO admin_players (
  name,
	country_id,
  nationality,
  base_club,
  season,
  source_type,
  special_skill,
  shooting,
  passing,
  long_pass,
  vision,
	gk_reach,
	counter_attack_awareness,
	defending,
	gk_parrying,
	gk_reflex,
	duels,
  pace,
  stamina,
  balance,
  technique,
  determination,
  physical,
	  standing_tackle,
	  sliding_tackle,
  dribbling,
  curve
) VALUES (?, ?, ?, ?, 'Normal', 'normal', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				name,
				countryID,
				country.Name,
				club.Name,
				shooting,
				passing,
				longPass,
				vision,
				gkReach,
				ctrAwareness,
				defAwareness,
				gkParrying,
				gkReflex,
				duels,
				pace,
				stamina,
				balance,
				technique,
				determination,
				strength,
				standingTackle,
				slidingTackle,
				dribbling,
				curve,
			)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func boundedStat(v int) int {
	if v < 1 {
		return 1
	}
	if v > 99 {
		return 99
	}
	return v
}

type rawClubSeed struct {
	Team rawClubTeam `json:"team"`
}

type rawClubTeam struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Country string `json:"country"`
	Logo    string `json:"logo"`
}

type rawCountrySeed struct {
	Name string  `json:"name"`
	Code *string `json:"code"`
	Flag *string `json:"flag"`
}

func loadSeededCountries() ([]defaultCountry, error) {
	seedFiles := []string{
		filepath.Join("database", "country.json"),
		filepath.Join("..", "database", "country.json"),
		filepath.Join("..", "..", "database", "country.json"),
	}

	for _, seedFile := range seedFiles {
		content, err := os.ReadFile(seedFile)
		if err != nil {
			continue
		}

		var rawCountries []rawCountrySeed
		if err := json.Unmarshal(content, &rawCountries); err != nil {
			continue
		}
		if len(rawCountries) == 0 {
			continue
		}

		countries := make([]defaultCountry, 0, len(rawCountries))
		for _, rawCountry := range rawCountries {
			name := strings.TrimSpace(rawCountry.Name)
			if name == "" {
				continue
			}
			code := ""
			if rawCountry.Code != nil {
				code = strings.TrimSpace(*rawCountry.Code)
			}
			flag := ""
			if rawCountry.Flag != nil {
				flag = strings.TrimSpace(*rawCountry.Flag)
			}
			countries = append(countries, defaultCountry{
				Name: name,
				Code: code,
				Flag: flag,
			})
		}

		if len(countries) > 0 {
			return countries, nil
		}
	}

	return seededCountries, nil
}

func loadSeededClubs() ([]defaultClub, error) {
	seedFiles := []string{
		filepath.Join("database", "england_club.json"),
		filepath.Join("..", "database", "england_club.json"),
		filepath.Join("..", "..", "database", "england_club.json"),
	}

	for _, seedFile := range seedFiles {
		content, err := os.ReadFile(seedFile)
		if err != nil {
			continue
		}

		var rawClubs []rawClubSeed
		if err := json.Unmarshal(content, &rawClubs); err != nil {
			continue
		}
		if len(rawClubs) == 0 {
			continue
		}

		clubs := make([]defaultClub, 0, len(rawClubs))
		for _, rawClub := range rawClubs {
			name := normalizeClubName(rawClub.Team.Name)
			if name == "" {
				continue
			}
			clubs = append(clubs, defaultClub{
				ID:          rawClub.Team.ID,
				Name:        name,
				Logo:        strings.TrimSpace(rawClub.Team.Logo),
				CountryName: strings.TrimSpace(rawClub.Team.Country),
				CountryCode: "GB-ENG",
				Budget:      clubBudgetFor(name),
				LeagueName:  "Premier League",
			})
		}

		return clubs, nil
	}

	return fallbackSeededClubs, nil
}

func normalizeClubName(name string) string {
	switch strings.TrimSpace(name) {
	case "":
		return ""
	case "Newcastle":
		return "Newcastle United"
	case "Tottenham":
		return "Tottenham Hotspur"
	case "Leicester":
		return "Leicester City"
	case "West Ham":
		return "West Ham United"
	case "Brighton":
		return "Brighton & Hove Albion"
	case "Wolves":
		return "Wolverhampton Wanderers"
	case "Bournemouth":
		return "AFC Bournemouth"
	default:
		return strings.TrimSpace(name)
	}
}

func clubBudgetFor(name string) int64 {
	switch name {
	case "Manchester United":
		return 120000000
	case "Manchester City":
		return 118000000
	case "Liverpool":
		return 116000000
	case "Chelsea":
		return 114000000
	case "Arsenal":
		return 112000000
	case "Tottenham Hotspur":
		return 110000000
	case "Newcastle United":
		return 108000000
	case "Aston Villa":
		return 106000000
	default:
		return 100000000
	}
}

func resolveCountryID(ctx context.Context, db *sql.DB, countryName string, countryCode string) (*uint64, error) {
	countryName = strings.TrimSpace(countryName)
	countryCode = strings.TrimSpace(countryCode)
	if countryName == "" && countryCode == "" {
		return nil, nil
	}

	var countryID uint64
	if countryCode != "" {
		err := db.QueryRowContext(ctx, `SELECT id FROM countries WHERE code = ? LIMIT 1`, countryCode).Scan(&countryID)
		if err == nil {
			return &countryID, nil
		}
		if err != sql.ErrNoRows {
			return nil, err
		}
	}

	if countryName != "" {
		err := db.QueryRowContext(ctx, `SELECT id FROM countries WHERE name = ? LIMIT 1`, countryName).Scan(&countryID)
		if err == nil {
			return &countryID, nil
		}
		if err != sql.ErrNoRows {
			return nil, err
		}
	}

	return nil, nil
}
