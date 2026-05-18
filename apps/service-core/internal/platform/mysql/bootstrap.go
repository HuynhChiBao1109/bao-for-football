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
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	UserID    uint64    `gorm:"not null;uniqueIndex:uk_teams_user_id;column:user_id"`
	ClubName  string    `gorm:"type:varchar(100);not null;column:club_name"`
	Image     string    `gorm:"type:varchar(500);not null;default:'';column:image"`
	Budget    int64     `gorm:"not null;default:360000000;column:budget"`
	RankPoint int       `gorm:"not null;default:0;column:rank_point"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
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

type migrationPlayerTemplate struct {
	ID                 uint64            `gorm:"primaryKey;autoIncrement;column:id"`
	Name               string            `gorm:"type:varchar(120);not null;index:idx_player_templates_name;column:name"`
	HeightCM           uint16            `gorm:"not null;column:height_cm"`
	CountryID          *uint64           `gorm:"index:idx_player_templates_country_id;column:country_id"`
	ClubID             *uint64           `gorm:"index:idx_player_templates_club_id;column:club_id"`
	BaseClub           string            `gorm:"type:varchar(120);not null;column:base_club"`
	Season             string            `gorm:"type:enum('normal','special year','special match','moment time');not null;default:normal;index:idx_player_templates_season;column:season"`
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
	Club               *migrationClub    `gorm:"foreignKey:ClubID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;"`
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

type migrationPlayerSkill struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	PlayerID  uint64    `gorm:"not null;index:idx_player_skills_player_id;uniqueIndex:uk_player_skills_player_skill,priority:1;column:player_id"`
	SkillID   uint64    `gorm:"not null;index:idx_player_skills_skill_id;uniqueIndex:uk_player_skills_player_skill,priority:2;column:skill_id"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (migrationPlayerSkill) TableName() string {
	return "player_skills"
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

type migrationGachaBanner struct {
	ID              uint64     `gorm:"primaryKey;autoIncrement;column:id"`
	BannerCode      string     `gorm:"type:varchar(80);not null;uniqueIndex:uk_gacha_banners_banner_code;column:banner_code"`
	BannerName      string     `gorm:"type:varchar(120);not null;column:banner_name"`
	BannerImageData string     `gorm:"type:longtext;not null;column:banner_image_data"`
	ExpiredAt       *time.Time `gorm:"column:expired_at"`
	Status          int        `gorm:"not null;default:1;column:status"`
	PlayerID        int64      `gorm:"not null;index:idx_gacha_banners_player_id;column:player_id"`
	CreatedAt       time.Time  `gorm:"column:created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at"`
}

func (migrationGachaBanner) TableName() string {
	return "gacha_banners"
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

type migrationPositionPlayer struct {
	ID               uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	PlayerTemplateID uint64    `gorm:"not null;index:idx_position_players_template_id;uniqueIndex:uk_position_players_template_position,priority:1;column:player_template_id"`
	Position         string    `gorm:"type:varchar(10);not null;uniqueIndex:uk_position_players_template_position,priority:2;column:position"`
	Description      string    `gorm:"type:varchar(255);not null;default:'';column:description"`
	Effect           float64   `gorm:"type:decimal(4,2);not null;default:1.00;column:effect"`
	CreatedAt        time.Time `gorm:"column:created_at"`
	UpdatedAt        time.Time `gorm:"column:updated_at"`
}

func (migrationPositionPlayer) TableName() string {
	return "position_players"
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
	LeagueName  string
}

var fallbackSeededClubs = []defaultClub{
	{ID: 1, Name: "Manchester United", Logo: "https://media.api-sports.io/football/teams/33.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 2, Name: "Manchester City", Logo: "https://media.api-sports.io/football/teams/50.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 3, Name: "Liverpool", Logo: "https://media.api-sports.io/football/teams/40.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 4, Name: "Chelsea", Logo: "https://media.api-sports.io/football/teams/49.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 5, Name: "Arsenal", Logo: "https://media.api-sports.io/football/teams/42.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 6, Name: "Tottenham Hotspur", Logo: "https://media.api-sports.io/football/teams/47.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 7, Name: "Newcastle United", Logo: "https://media.api-sports.io/football/teams/34.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
	{ID: 8, Name: "Aston Villa", Logo: "https://media.api-sports.io/football/teams/66.png", CountryName: "England", CountryCode: "GB-ENG", LeagueName: "Premier League"},
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

	if err := ensureLegacyTableRenames(ctx, sqlDB); err != nil {
		return err
	}

	if err := ensureClubSchema(ctx, sqlDB); err != nil {
		return err
	}
	if err := ensureTeamSchema(ctx, sqlDB); err != nil {
		return err
	}

	if err := db.WithContext(ctx).Set("gorm:table_options", "ENGINE=InnoDB").AutoMigrate(
		&migrationClub{},
		&migrationCountry{},
		&migrationPlayerTemplate{},
		&migrationPositionPlayer{},
		&migrationSkill{},
		&migrationPlayerSkill{},
		&migrationUser{},
		&migrationTeam{},
		&migrationUserPlayer{},
		&migrationGachaLog{},
		&migrationGachaBanner{},
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
	if err := ensureTeamSchema(ctx, sqlDB); err != nil {
		return err
	}
	if err := ensureGachaBannerSchema(ctx, sqlDB); err != nil {
		return err
	}
	if err := ensureGachaBannerSchema(ctx, sqlDB); err != nil {
		return err
	}
	if err := ensurePlayerTemplateSchema(ctx, sqlDB); err != nil {
		return err
	}
	if err := ensurePositionPlayerBackfill(ctx, sqlDB); err != nil {
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
	if err := ensureManUTDPlayers(ctx, db); err != nil {
		return fmt.Errorf("ensureManUTDPlayers: %w", err)
	}
	if err := ensureDefaultPlayers(ctx, db); err != nil {
		return fmt.Errorf("ensureDefaultPlayers: %w", err)
	}

	return nil
}

func ensurePositionPlayerBackfill(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return nil
	}

	_, err := db.ExecContext(ctx, `
INSERT INTO position_players (player_template_id, position, description, effect)
SELECT
	pt.id,
	CASE
		WHEN (pt.base_gk_reach + pt.base_gk_parrying + pt.base_gk_reflex) >= GREATEST(
			(pt.base_defending + pt.base_standing_tackle + pt.base_sliding_tackle + pt.base_physical),
			(pt.base_shooting + pt.base_counter_attack_awareness + pt.base_pace),
			(pt.base_passing + pt.base_long_pass + pt.base_vision + pt.base_stamina),
			(pt.base_pace + pt.base_dribbling + pt.base_curve)
		) THEN 'GK'
		WHEN (pt.base_defending + pt.base_standing_tackle + pt.base_sliding_tackle + pt.base_physical) >= GREATEST(
			(pt.base_shooting + pt.base_counter_attack_awareness + pt.base_pace),
			(pt.base_passing + pt.base_long_pass + pt.base_vision + pt.base_stamina),
			(pt.base_pace + pt.base_dribbling + pt.base_curve)
		) THEN 'CB'
		WHEN (pt.base_shooting + pt.base_counter_attack_awareness + pt.base_pace) >= GREATEST(
			(pt.base_passing + pt.base_long_pass + pt.base_vision + pt.base_stamina),
			(pt.base_pace + pt.base_dribbling + pt.base_curve)
		) THEN 'CF'
		WHEN (pt.base_passing + pt.base_long_pass + pt.base_vision + pt.base_stamina) >= (pt.base_pace + pt.base_dribbling + pt.base_curve)
			THEN 'CM'
		ELSE 'LW'
	END AS position,
	'Auto migrated primary position' AS description,
	1.00 AS effect
FROM player_templates pt
LEFT JOIN position_players pp ON pp.player_template_id = pt.id
WHERE pp.id IS NULL`)

	return err
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

func hasTable(ctx context.Context, db *sql.DB, tableName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = ?`, tableName).Scan(&count)
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

func ensureLegacyTableRenames(ctx context.Context, db *sql.DB) error {
	legacyMappings := []struct {
		oldName string
		newName string
	}{
		{oldName: "admin_gacha_banners", newName: "gacha_banners"},
		{oldName: "admin_player_skills", newName: "player_skills"},
	}

	for _, mapping := range legacyMappings {
		oldExists, err := hasTable(ctx, db, mapping.oldName)
		if err != nil {
			return err
		}
		if !oldExists {
			continue
		}

		newExists, err := hasTable(ctx, db, mapping.newName)
		if err != nil {
			return err
		}
		if newExists {
			continue
		}

		if _, err := db.ExecContext(ctx, fmt.Sprintf("RENAME TABLE %s TO %s", mapping.oldName, mapping.newName)); err != nil {
			return err
		}
	}

	return nil
}

func ensurePlayerTemplateSchema(ctx context.Context, db *sql.DB) error {
	clubIDExists, err := hasColumn(ctx, db, "player_templates", "club_id")
	if err != nil {
		return err
	}
	if !clubIDExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE player_templates ADD COLUMN club_id bigint unsigned NULL AFTER country_id`); err != nil {
			return err
		}
	}

	if _, err := db.ExecContext(ctx, `
UPDATE player_templates pt
INNER JOIN clubs c ON c.name = pt.base_club
SET pt.club_id = c.id
WHERE pt.club_id IS NULL`); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, `
UPDATE player_templates
SET season = 'normal'
WHERE season IN ('Normal', 'NORMAL')`); err != nil {
		return err
	}
	if _, err := db.ExecContext(ctx, `
UPDATE player_templates
SET season = 'special year'
WHERE season IN ('Special', 'SPECIAL')`); err != nil {
		return err
	}

	nationalityExists, err := hasColumn(ctx, db, "player_templates", "nationality")
	if err != nil {
		return err
	}
	if nationalityExists {
		if _, err := db.ExecContext(ctx, `
UPDATE player_templates pt
INNER JOIN countries c ON c.name = pt.nationality
SET pt.country_id = c.id
WHERE pt.country_id IS NULL`); err != nil {
			return err
		}
		if _, err := db.ExecContext(ctx, `ALTER TABLE player_templates DROP COLUMN nationality`); err != nil {
			return err
		}
	}

	return nil
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

	budgetExists, err := hasColumn(ctx, db, "clubs", "budget")
	if err != nil {
		return err
	}
	if budgetExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE clubs DROP COLUMN budget`); err != nil {
			return err
		}
	}

	return nil
}

func ensureTeamSchema(ctx context.Context, db *sql.DB) error {
	teamsExists, err := hasTable(ctx, db, "teams")
	if err != nil {
		return err
	}
	if !teamsExists {
		return nil
	}

	imageExists, err := hasColumn(ctx, db, "teams", "image")
	if err != nil {
		return err
	}
	if !imageExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE teams ADD COLUMN image varchar(500) NOT NULL DEFAULT '' AFTER club_name`); err != nil {
			return err
		}
	}

	if _, err := db.ExecContext(ctx, `
UPDATE teams t
LEFT JOIN clubs c ON c.name = t.club_name
SET t.image = COALESCE(c.logo, '')
WHERE t.image = ''`); err != nil {
		return err
	}

	clubIDExists, err := hasColumn(ctx, db, "teams", "club_id")
	if err != nil {
		return err
	}
	if clubIDExists {
		rows, err := db.QueryContext(ctx, `
SELECT CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'teams'
  AND COLUMN_NAME = 'club_id'
  AND REFERENCED_TABLE_NAME IS NOT NULL`)
		if err != nil {
			return err
		}
		constraints := make([]string, 0, 2)
		for rows.Next() {
			var constraintName string
			if err := rows.Scan(&constraintName); err != nil {
				rows.Close()
				return err
			}
			constraints = append(constraints, constraintName)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return err
		}
		rows.Close()

		for _, constraintName := range constraints {
			if _, err := db.ExecContext(ctx, fmt.Sprintf("ALTER TABLE teams DROP FOREIGN KEY %s", constraintName)); err != nil {
				return err
			}
		}

		if _, err := db.ExecContext(ctx, `ALTER TABLE teams DROP COLUMN club_id`); err != nil {
			return err
		}
	}

	if _, err := db.ExecContext(ctx, `
UPDATE teams
SET budget = 360000000`); err != nil {
		return err
	}

	if _, err := db.ExecContext(ctx, `
ALTER TABLE teams
MODIFY COLUMN budget bigint NOT NULL DEFAULT 360000000`); err != nil {
		return err
	}

	return nil
}

func ensureGachaBannerSchema(ctx context.Context, db *sql.DB) error {
	bannerTableExists, err := hasTable(ctx, db, "gacha_banners")
	if err != nil {
		return err
	}
	if !bannerTableExists {
		return nil
	}

	expiredAtExists, err := hasColumn(ctx, db, "gacha_banners", "expired_at")
	if err != nil {
		return err
	}
	if !expiredAtExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE gacha_banners ADD COLUMN expired_at datetime NULL AFTER banner_image_data`); err != nil {
			return err
		}
	}

	statusExists, err := hasColumn(ctx, db, "gacha_banners", "status")
	if err != nil {
		return err
	}
	if !statusExists {
		if _, err := db.ExecContext(ctx, `ALTER TABLE gacha_banners ADD COLUMN status int NOT NULL DEFAULT 1 AFTER expired_at`); err != nil {
			return err
		}
	}

	if _, err := db.ExecContext(ctx, `
UPDATE gacha_banners
SET status = 4
WHERE expired_at IS NOT NULL
  AND expired_at <= CURRENT_TIMESTAMP
  AND status <> 4`); err != nil {
		return err
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
INSERT IGNORE INTO clubs (id, name, logo, country_id, league_name)
VALUES (?, ?, ?, ?, ?)`,
			club.ID,
			club.Name,
			club.Logo,
			countryID,
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
	nationalityExists, err := hasColumn(ctx, db, "player_templates", "nationality")
	if err != nil {
		return err
	}
	if nationalityExists {
		if _, err := db.ExecContext(ctx, `
UPDATE player_templates pt
INNER JOIN countries c ON c.name = pt.nationality
SET pt.country_id = c.id
WHERE pt.country_id IS NULL`); err != nil {
			return err
		}
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
FROM player_templates
WHERE season = 'normal' AND base_club = ?`, club.Name).Scan(&existingCount)
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
INSERT INTO player_templates (
  name,
	height_cm,
	country_id,
	club_id,
  base_club,
  season,
	image_url,
	base_shooting,
	base_passing,
	base_long_pass,
	base_vision,
	base_gk_reach,
	base_counter_attack_awareness,
	base_defending,
	base_gk_parrying,
	base_gk_reflex,
	base_duels,
	base_pace,
	base_stamina,
	base_balance,
	base_technique,
	base_determination,
	base_physical,
	base_standing_tackle,
	base_sliding_tackle,
	base_dribbling,
	base_curve
) VALUES (?, 170, ?, ?, ?, 'normal', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				name,
				countryID,
				club.ID,
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

type rawManUTDSeed struct {
	Team    rawManUTDTeam     `json:"team"`
	Players []rawManUTDPlayer `json:"players"`
}

type rawManUTDTeam struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Logo string `json:"logo"`
}

type rawManUTDPlayer struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Age      int    `json:"age"`
	Number   int    `json:"number"`
	Position string `json:"position"`
	Photo    string `json:"photo"`
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

func ensureManUTDPlayers(ctx context.Context, db *sql.DB) error {
	const (
		manUTDClubID    int64 = 33
		unknownCountry  int64 = 168
		defaultHeightCM int   = 170
		defaultStat     int   = 60
	)

	seed, err := loadManUTDPlayers()
	if err != nil {
		return err
	}
	if len(seed.Players) == 0 {
		return nil
	}

	if err := ensureCountryID(ctx, db, unknownCountry); err != nil {
		return err
	}

	baseClub := strings.TrimSpace(seed.Team.Name)
	if baseClub == "" {
		baseClub = "Manchester United"
	}

	for _, player := range seed.Players {
		name := strings.TrimSpace(player.Name)
		if name == "" {
			continue
		}

		avatar := strings.TrimSpace(player.Photo)

		var existingID int64
		err := db.QueryRowContext(ctx, `
SELECT id
FROM player_templates
WHERE club_id = ?
  AND season = 'normal'
  AND LOWER(name) = LOWER(?)
LIMIT 1`, manUTDClubID, name).Scan(&existingID)
		if err != nil && err != sql.ErrNoRows {
			return err
		}

		if err == sql.ErrNoRows {
			_, err = db.ExecContext(ctx, `
INSERT INTO player_templates (
  name,
  height_cm,
  country_id,
  club_id,
  base_club,
  season,
  image_url,
  base_shooting,
  base_passing,
  base_long_pass,
  base_vision,
  base_gk_reach,
  base_counter_attack_awareness,
  base_defending,
  base_gk_parrying,
  base_gk_reflex,
  base_duels,
  base_pace,
  base_stamina,
  base_balance,
  base_technique,
  base_determination,
  base_physical,
  base_standing_tackle,
  base_sliding_tackle,
  base_dribbling,
  base_curve
) VALUES (?, ?, ?, ?, ?, 'normal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				name,
				defaultHeightCM,
				unknownCountry,
				manUTDClubID,
				baseClub,
				avatar,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
				defaultStat,
			)
			if err != nil {
				return err
			}
			continue
		}

		_, err = db.ExecContext(ctx, `
UPDATE player_templates
SET
  country_id = ?,
  club_id = ?,
  base_club = ?,
  season = 'normal',
  image_url = ?,
  base_shooting = ?,
  base_passing = ?,
  base_long_pass = ?,
  base_vision = ?,
  base_gk_reach = ?,
  base_counter_attack_awareness = ?,
  base_defending = ?,
  base_gk_parrying = ?,
  base_gk_reflex = ?,
  base_duels = ?,
  base_pace = ?,
  base_stamina = ?,
  base_balance = ?,
  base_technique = ?,
  base_determination = ?,
  base_physical = ?,
  base_standing_tackle = ?,
  base_sliding_tackle = ?,
  base_dribbling = ?,
  base_curve = ?
WHERE id = ?`,
			unknownCountry,
			manUTDClubID,
			baseClub,
			avatar,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			defaultStat,
			existingID,
		)
		if err != nil {
			return err
		}
	}

	return nil
}

func ensureCountryID(ctx context.Context, db *sql.DB, countryID int64) error {
	if countryID <= 0 {
		return nil
	}

	var exists int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM countries WHERE id = ?`, countryID).Scan(&exists); err != nil {
		return err
	}
	if exists > 0 {
		return nil
	}

	_, err := db.ExecContext(ctx, `
INSERT INTO countries (id, name, code, flag)
VALUES (?, ?, ?, ?)`, countryID, fmt.Sprintf("Unknown (%d)", countryID), fmt.Sprintf("UNK-%d", countryID), "")
	return err
}

func loadManUTDPlayers() (rawManUTDSeed, error) {
	seedFiles := []string{
		filepath.Join("database", "manUTD_player.json"),
		filepath.Join("..", "database", "manUTD_player.json"),
		filepath.Join("..", "..", "database", "manUTD_player.json"),
	}

	for _, seedFile := range seedFiles {
		content, err := os.ReadFile(seedFile)
		if err != nil {
			continue
		}

		var raw []rawManUTDSeed
		if err := json.Unmarshal(content, &raw); err != nil {
			continue
		}
		if len(raw) == 0 {
			continue
		}

		seed := raw[0]
		seed.Players = compactManUTDPlayers(seed.Players)
		return seed, nil
	}

	return rawManUTDSeed{}, nil
}

func compactManUTDPlayers(players []rawManUTDPlayer) []rawManUTDPlayer {
	if len(players) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(players))
	out := make([]rawManUTDPlayer, 0, len(players))
	for _, item := range players {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		item.Name = name
		out = append(out, item)
	}

	return out
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
