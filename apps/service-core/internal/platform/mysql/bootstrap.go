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

type migrationAdminPlayer struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name         string    `gorm:"type:varchar(120);not null;column:name"`
	Nationality  string    `gorm:"type:varchar(80);not null;column:nationality"`
	BaseClub     string    `gorm:"type:varchar(120);not null;column:base_club"`
	Season       string    `gorm:"type:enum('Normal','Special');not null;default:Normal;index:idx_admin_players_season;column:season"`
	SourceType   string    `gorm:"type:enum('normal','gacha');not null;default:normal;index:idx_admin_players_source_type;column:source_type"`
	SpecialSkill string    `gorm:"type:varchar(120);not null;default:'';column:special_skill"`
	Shooting     uint8     `gorm:"not null;column:shooting"`
	Passing      uint8     `gorm:"not null;column:passing"`
	Pace         uint8     `gorm:"not null;column:pace"`
	Physical     uint8     `gorm:"not null;column:physical"`
	Defending    uint8     `gorm:"not null;column:defending"`
	Dribbling    uint8     `gorm:"not null;column:dribbling"`
	CreatedAt    time.Time `gorm:"column:created_at"`
}

func (migrationAdminPlayer) TableName() string {
	return "admin_players"
}

type migrationPlayerTemplate struct {
	ID            uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name          string    `gorm:"type:varchar(120);not null;index:idx_player_templates_name;column:name"`
	HeightCM      uint16    `gorm:"not null;column:height_cm"`
	Nationality   string    `gorm:"type:varchar(80);not null;column:nationality"`
	BaseClub      string    `gorm:"type:varchar(120);not null;column:base_club"`
	Season        string    `gorm:"type:enum('Normal','Special');not null;default:Normal;index:idx_player_templates_season;column:season"`
	ImageURL      string    `gorm:"type:varchar(500);column:image_url"`
	BaseShooting  int       `gorm:"not null;default:1;column:base_shooting"`
	BasePassing   int       `gorm:"not null;default:1;column:base_passing"`
	BasePace      int       `gorm:"not null;default:1;column:base_pace"`
	BasePhysical  int       `gorm:"not null;default:1;column:base_physical"`
	BaseDefending int       `gorm:"not null;default:1;column:base_defending"`
	BaseDribbling int       `gorm:"not null;default:1;column:base_dribbling"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

func (migrationPlayerTemplate) TableName() string {
	return "player_templates"
}

type migrationUserPlayer struct {
	ID               uint64                  `gorm:"primaryKey;autoIncrement;column:id"`
	UserID           uint64                  `gorm:"not null;index:idx_user_players_user_id;column:user_id"`
	PlayerTemplateID uint64                  `gorm:"not null;index:idx_user_players_template_id;column:player_template_id"`
	Level            uint8                   `gorm:"not null;default:1;check:ck_user_players_level,level BETWEEN 1 AND 36;column:level"`
	Exp              uint32                  `gorm:"not null;default:0;column:exp"`
	CurrentPoints    uint32                  `gorm:"not null;default:0;column:current_points"`
	BonusShooting    int                     `gorm:"not null;default:0;column:bonus_shooting"`
	BonusPassing     int                     `gorm:"not null;default:0;column:bonus_passing"`
	BonusPace        int                     `gorm:"not null;default:0;column:bonus_pace"`
	BonusPhysical    int                     `gorm:"not null;default:0;column:bonus_physical"`
	BonusDefending   int                     `gorm:"not null;default:0;column:bonus_defending"`
	BonusDribbling   int                     `gorm:"not null;default:0;column:bonus_dribbling"`
	ObtainedAt       time.Time               `gorm:"column:obtained_at"`
	CreatedAt        time.Time               `gorm:"column:created_at"`
	UpdatedAt        time.Time               `gorm:"column:updated_at"`
	Template         migrationPlayerTemplate `gorm:"foreignKey:PlayerTemplateID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;"`
}

func (migrationUserPlayer) TableName() string {
	return "user_players"
}

type migrationSkill struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement;column:id"`
	Name      string    `gorm:"type:varchar(120);not null;uniqueIndex:uk_skills_name;column:name"`
	IconURL   string    `gorm:"type:varchar(500);column:icon_url"`
	BuffType  string    `gorm:"type:enum('shooting','passing','pace','physical','defending','dribbling');not null;column:buff_type"`
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
}

var seededNationalities = []string{
	"Vietnam",
	"Brazil",
	"Argentina",
	"Spain",
	"France",
	"Germany",
	"Portugal",
	"England",
}

func AutoMigrate(ctx context.Context, db *gorm.DB) error {
	if db == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := db.WithContext(ctx).Set("gorm:table_options", "ENGINE=InnoDB").AutoMigrate(
		&migrationClub{},
		&migrationAdminPlayer{},
		&migrationPlayerTemplate{},
		&migrationSkill{},
		&migrationUser{},
		&migrationTeam{},
		&migrationUserPlayer{},
		&migrationGachaLog{},
		&migrationTeamTactics{},
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
			nationality := seededNationalities[(globalIdx-1)%len(seededNationalities)]
			shooting := boundedStat(60 + (globalIdx % 18))
			passing := boundedStat(58 + ((globalIdx + 3) % 18))
			pace := boundedStat(57 + ((globalIdx + 6) % 18))
			physical := boundedStat(55 + ((globalIdx + 9) % 18))
			defending := boundedStat(54 + ((globalIdx + 12) % 18))
			dribbling := boundedStat(59 + ((globalIdx + 15) % 18))

			_, err := db.ExecContext(ctx, `
INSERT INTO admin_players (
  name,
  nationality,
  base_club,
  season,
  source_type,
  special_skill,
  shooting,
  passing,
  pace,
  physical,
  defending,
  dribbling
) VALUES (?, ?, ?, 'Normal', 'normal', '', ?, ?, ?, ?, ?, ?)`,
				name,
				nationality,
				club.Name,
				shooting,
				passing,
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
