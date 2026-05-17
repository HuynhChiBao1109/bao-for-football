package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type migrationClub struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name       string    `gorm:"type:varchar(120);not null;uniqueIndex:uk_clubs_name;column:name"`
	Formation  string    `gorm:"type:varchar(20);not null;column:formation"`
	Budget     int64     `gorm:"not null;default:0;column:budget"`
	LeagueName string    `gorm:"type:varchar(120);not null;column:league_name"`
	CreatedAt  time.Time `gorm:"column:created_at"`
	UpdatedAt  time.Time `gorm:"column:updated_at"`
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
	Nationality    string            `gorm:"type:varchar(80);not null;column:nationality"`
	BaseClub       string            `gorm:"type:varchar(120);not null;column:base_club"`
	Season         string            `gorm:"type:enum('Normal','Special');not null;default:Normal;index:idx_admin_players_season;column:season"`
	SourceType     string            `gorm:"type:enum('normal','gacha');not null;default:normal;index:idx_admin_players_source_type;column:source_type"`
	SpecialSkill   string            `gorm:"type:varchar(120);not null;default:'';column:special_skill"`
	Shooting       uint8             `gorm:"not null;column:shooting"`
	Passing        uint8             `gorm:"not null;column:passing"`
	LongPass       uint8             `gorm:"not null;default:60;column:long_pass"`
	Vision         uint8             `gorm:"not null;default:60;column:vision"`
	DefAwareness   uint8             `gorm:"not null;default:60;column:defensive_awareness"`
	CtrAwareness   uint8             `gorm:"not null;default:60;column:counter_attack_awareness"`
	Crossbar       uint8             `gorm:"not null;default:60;column:crossbar_handling"`
	Reflexes       uint8             `gorm:"not null;default:60;column:reflexes"`
	AerialCatch    uint8             `gorm:"not null;default:60;column:aerial_catching"`
	Duels          uint8             `gorm:"not null;default:60;column:duels"`
	Pace           uint8             `gorm:"not null;column:pace"`
	Physical       uint8             `gorm:"not null;column:physical"`
	Defending      uint8             `gorm:"not null;column:defending"`
	StandingTackle uint8             `gorm:"not null;default:60;column:standing_tackle"`
	SlidingTackle  uint8             `gorm:"not null;default:60;column:sliding_tackle"`
	Dribbling      uint8             `gorm:"not null;column:dribbling"`
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
	BaseDefAware       int               `gorm:"not null;default:1;column:base_defensive_awareness"`
	BaseCtrAware       int               `gorm:"not null;default:1;column:base_counter_attack_awareness"`
	BaseCrossbar       int               `gorm:"not null;default:1;column:base_crossbar_handling"`
	BaseReflexes       int               `gorm:"not null;default:1;column:base_reflexes"`
	BaseAerial         int               `gorm:"not null;default:1;column:base_aerial_catching"`
	BaseDuels          int               `gorm:"not null;default:1;column:base_duels"`
	BasePace           int               `gorm:"not null;default:1;column:base_pace"`
	BasePhysical       int               `gorm:"not null;default:1;column:base_physical"`
	BaseDefending      int               `gorm:"not null;default:1;column:base_defending"`
	BaseStandingTackle int               `gorm:"not null;default:1;column:base_standing_tackle"`
	BaseSlidingTackle  int               `gorm:"not null;default:1;column:base_sliding_tackle"`
	BaseDribbling      int               `gorm:"not null;default:1;column:base_dribbling"`
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
	BonusDefAware       int                     `gorm:"not null;default:0;column:bonus_defensive_awareness"`
	BonusCtrAware       int                     `gorm:"not null;default:0;column:bonus_counter_attack_awareness"`
	BonusCrossbar       int                     `gorm:"not null;default:0;column:bonus_crossbar_handling"`
	BonusReflexes       int                     `gorm:"not null;default:0;column:bonus_reflexes"`
	BonusAerial         int                     `gorm:"not null;default:0;column:bonus_aerial_catching"`
	BonusDuels          int                     `gorm:"not null;default:0;column:bonus_duels"`
	BonusPace           int                     `gorm:"not null;default:0;column:bonus_pace"`
	BonusPhysical       int                     `gorm:"not null;default:0;column:bonus_physical"`
	BonusDefending      int                     `gorm:"not null;default:0;column:bonus_defending"`
	BonusStandingTackle int                     `gorm:"not null;default:0;column:bonus_standing_tackle"`
	BonusSlidingTackle  int                     `gorm:"not null;default:0;column:bonus_sliding_tackle"`
	BonusDribbling      int                     `gorm:"not null;default:0;column:bonus_dribbling"`
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
	BuffType  string    `gorm:"type:enum('shooting','passing','longPass','vision','defensiveAwareness','counterAttackAwareness','crossbarHandling','reflexes','aerialCatching','duels','pace','physical','defending','standingTackle','slidingTackle','dribbling');not null;column:buff_type"`
	BuffValue int       `gorm:"not null;default:1;column:buff_value"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (migrationSkill) TableName() string {
	return "skills"
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
	ID         int64
	Name       string
	Formation  string
	Budget     int64
	LeagueName string
}

var seededClubs = []defaultClub{
	{ID: 1, Name: "FC Navy", Formation: "4-3-3", Budget: 120000000, LeagueName: "Premier League"},
	{ID: 2, Name: "Crimson United", Formation: "4-2-3-1", Budget: 115000000, LeagueName: "Premier League"},
	{ID: 3, Name: "Golden Phoenix", Formation: "3-5-2", Budget: 110000000, LeagueName: "Championship"},
	{ID: 4, Name: "Azure Storm", Formation: "4-4-2", Budget: 108000000, LeagueName: "Serie A"},
	{ID: 5, Name: "Emerald Rovers", Formation: "4-1-4-1", Budget: 106000000, LeagueName: "La Liga"},
	{ID: 6, Name: "Ivory Titans", Formation: "3-4-3", Budget: 112000000, LeagueName: "Bundesliga"},
	{ID: 7, Name: "Shadow Rangers", Formation: "5-3-2", Budget: 103000000, LeagueName: "Ligue 1"},
	{ID: 8, Name: "Ruby Comets", Formation: "4-2-2-2", Budget: 109000000, LeagueName: "Eredivisie"},
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

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := db.WithContext(ctx).Set("gorm:table_options", "ENGINE=InnoDB").AutoMigrate(
		&migrationClub{},
		&migrationCountry{},
		&migrationAdminPlayer{},
		&migrationPlayerTemplate{},
		&migrationSkill{},
		&migrationUser{},
		&migrationTeam{},
		&migrationUserPlayer{},
		&migrationGachaLog{},
		&migrationTeamTactics{},
		&migrationAIUserStage{},
		&migrationMatch{},
		&migrationMatchScorer{},
	); err != nil {
		return err
	}

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	return ensureTriggers(ctx, sqlDB)
}

func EnsureSeedData(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := ensureDefaultClubs(ctx, db); err != nil {
		return err
	}
	if err := ensureCountries(ctx, db); err != nil {
		return err
	}
	if err := backfillCountryRelations(ctx, db); err != nil {
		return err
	}
	if err := ensureDefaultPlayers(ctx, db); err != nil {
		return err
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

func ensureDefaultClubs(ctx context.Context, db *sql.DB) error {
	for _, club := range seededClubs {
		_, err := db.ExecContext(ctx, `
INSERT INTO clubs (id, name, formation, budget, league_name)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  formation = VALUES(formation),
  budget = VALUES(budget),
  league_name = VALUES(league_name)`,
			club.ID,
			club.Name,
			club.Formation,
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
	for _, country := range seededCountries {
		_, err := db.ExecContext(ctx, `
INSERT INTO countries (name, code, flag)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  flag = VALUES(flag)`,
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
	for clubIndex, club := range seededClubs {
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
			defAwareness := boundedStat(55 + ((globalIdx + 4) % 18))
			ctrAwareness := boundedStat(56 + ((globalIdx + 8) % 18))
			crossbar := boundedStat(54 + ((globalIdx + 10) % 18))
			reflexes := boundedStat(58 + ((globalIdx + 11) % 18))
			aerialCatch := boundedStat(57 + ((globalIdx + 13) % 18))
			duels := boundedStat(59 + ((globalIdx + 14) % 18))
			pace := boundedStat(57 + ((globalIdx + 6) % 18))
			physical := boundedStat(55 + ((globalIdx + 9) % 18))
			defending := boundedStat(54 + ((globalIdx + 12) % 18))
			dribbling := boundedStat(59 + ((globalIdx + 15) % 18))

			_, err := db.ExecContext(ctx, `
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
	defensive_awareness,
	counter_attack_awareness,
	crossbar_handling,
	reflexes,
	aerial_catching,
	duels,
  pace,
  physical,
  defending,
  dribbling
) VALUES (?, ?, ?, ?, 'Normal', 'normal', '', ?, ?, ?, ?, ?, ?, ?, ?)`,
				name,
				countryID,
				country.Name,
				club.Name,
				shooting,
				passing,
				longPass,
				vision,
				defAwareness,
				ctrAwareness,
				crossbar,
				reflexes,
				aerialCatch,
				duels,
				pace,
				physical,
				defending,
				dribbling,
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
