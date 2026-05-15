package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

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

func EnsureBootstrap(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return nil
	}

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := ensureTables(ctx, db); err != nil {
		return err
	}
	if err := ensureDefaultClubs(ctx, db); err != nil {
		return err
	}
	if err := ensureDefaultPlayers(ctx, db); err != nil {
		return err
	}

	return nil
}

func ensureTables(ctx context.Context, db *sql.DB) error {
	createQueries := []string{
		`CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS clubs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  formation VARCHAR(20) NOT NULL,
  budget BIGINT NOT NULL DEFAULT 0,
  league_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_clubs_name (name)
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS teams (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  club_name VARCHAR(100) NOT NULL,
  budget BIGINT NOT NULL DEFAULT 0,
  rank_point INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_teams_user_id (user_id),
  CONSTRAINT fk_teams_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS admin_players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  nationality VARCHAR(80) NOT NULL,
  base_club VARCHAR(120) NOT NULL,
  season ENUM('Normal', 'Special') NOT NULL DEFAULT 'Normal',
  source_type ENUM('normal', 'gacha') NOT NULL DEFAULT 'normal',
  special_skill VARCHAR(120) NOT NULL DEFAULT '',
  shooting TINYINT UNSIGNED NOT NULL,
  passing TINYINT UNSIGNED NOT NULL,
  pace TINYINT UNSIGNED NOT NULL,
  physical TINYINT UNSIGNED NOT NULL,
  defending TINYINT UNSIGNED NOT NULL,
  dribbling TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_players_season (season),
  KEY idx_admin_players_source_type (source_type)
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS player_templates (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	name VARCHAR(120) NOT NULL,
	height_cm SMALLINT UNSIGNED NOT NULL,
	nationality VARCHAR(80) NOT NULL,
	base_club VARCHAR(120) NOT NULL,
	season ENUM('Normal', 'Special') NOT NULL DEFAULT 'Normal',
	image_url VARCHAR(500) NULL,
	base_shooting SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	base_passing SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	base_pace SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	base_physical SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	base_defending SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	base_dribbling SMALLINT UNSIGNED NOT NULL DEFAULT 1,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_player_templates_season (season),
	KEY idx_player_templates_name (name)
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS skills (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	name VARCHAR(120) NOT NULL,
	icon_url VARCHAR(500) NULL,
	buff_type ENUM('shooting', 'passing', 'pace', 'physical', 'defending', 'dribbling') NOT NULL,
	buff_value SMALLINT NOT NULL DEFAULT 1,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uk_skills_name (name)
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS user_players (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	player_template_id BIGINT UNSIGNED NOT NULL,
	level TINYINT UNSIGNED NOT NULL DEFAULT 1,
	exp INT UNSIGNED NOT NULL DEFAULT 0,
	current_points INT UNSIGNED NOT NULL DEFAULT 0,
	bonus_shooting SMALLINT NOT NULL DEFAULT 0,
	bonus_passing SMALLINT NOT NULL DEFAULT 0,
	bonus_pace SMALLINT NOT NULL DEFAULT 0,
	bonus_physical SMALLINT NOT NULL DEFAULT 0,
	bonus_defending SMALLINT NOT NULL DEFAULT 0,
	bonus_dribbling SMALLINT NOT NULL DEFAULT 0,
	obtained_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_user_players_user_id (user_id),
	KEY idx_user_players_template_id (player_template_id),
	CONSTRAINT ck_user_players_level CHECK (level BETWEEN 1 AND 36),
	CONSTRAINT fk_user_players_user_id
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT fk_user_players_template_id
		FOREIGN KEY (player_template_id) REFERENCES player_templates(id)
		ON DELETE RESTRICT
		ON UPDATE CASCADE
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS gacha_logs (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	user_id BIGINT UNSIGNED NOT NULL,
	user_player_id BIGINT UNSIGNED NULL,
	banner_code VARCHAR(50) NOT NULL,
	pull_count_since_last_high_rarity INT UNSIGNED NOT NULL DEFAULT 0,
	pity_threshold SMALLINT UNSIGNED NOT NULL DEFAULT 60,
	is_pity_triggered TINYINT(1) NOT NULL DEFAULT 0,
	rarity ENUM('N', 'R', 'SR', 'SSR', 'UR') NOT NULL,
	pulled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	KEY idx_gacha_logs_user_id (user_id),
	KEY idx_gacha_logs_banner_code (banner_code),
	CONSTRAINT fk_gacha_logs_user_id
		FOREIGN KEY (user_id) REFERENCES users(id)
		ON DELETE CASCADE
		ON UPDATE CASCADE,
	CONSTRAINT fk_gacha_logs_user_player_id
		FOREIGN KEY (user_player_id) REFERENCES user_players(id)
		ON DELETE SET NULL
		ON UPDATE CASCADE
) ENGINE=InnoDB`,
		`CREATE TABLE IF NOT EXISTS team_tactics (
	id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
	team_id VARCHAR(32) NOT NULL,
	formation VARCHAR(10) NOT NULL,
	pass_ratio DOUBLE NOT NULL,
	shot_ratio DOUBLE NOT NULL,
	pressure DOUBLE NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	PRIMARY KEY (id),
	UNIQUE KEY uk_team_tactics_team_id (team_id)
) ENGINE=InnoDB`,
	}

	for _, query := range createQueries {
		if _, err := db.ExecContext(ctx, query); err != nil {
			return err
		}
	}

	if err := syncExistingTables(ctx, db); err != nil {
		return err
	}

	return nil
}

func syncExistingTables(ctx context.Context, db *sql.DB) error {
	columnSync := []struct {
		table  string
		column string
		clause string
	}{
		{"users", "updated_at", "ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"},
		{"clubs", "league_name", "ADD COLUMN league_name VARCHAR(120) NOT NULL DEFAULT ''"},
		{"teams", "rank_point", "ADD COLUMN rank_point INT NOT NULL DEFAULT 0"},
		{"admin_players", "source_type", "ADD COLUMN source_type ENUM('normal', 'gacha') NOT NULL DEFAULT 'normal'"},
		{"admin_players", "special_skill", "ADD COLUMN special_skill VARCHAR(120) NOT NULL DEFAULT ''"},
		{"player_templates", "height_cm", "ADD COLUMN height_cm SMALLINT UNSIGNED NOT NULL DEFAULT 170"},
		{"player_templates", "image_url", "ADD COLUMN image_url VARCHAR(500) NULL"},
		{"gacha_logs", "pull_count_since_last_high_rarity", "ADD COLUMN pull_count_since_last_high_rarity INT UNSIGNED NOT NULL DEFAULT 0"},
		{"gacha_logs", "pity_threshold", "ADD COLUMN pity_threshold SMALLINT UNSIGNED NOT NULL DEFAULT 60"},
		{"gacha_logs", "is_pity_triggered", "ADD COLUMN is_pity_triggered TINYINT(1) NOT NULL DEFAULT 0"},
		{"gacha_logs", "pulled_at", "ADD COLUMN pulled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"},
		{"team_tactics", "updated_at", "ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"},
	}

	for _, item := range columnSync {
		if err := ensureColumn(ctx, db, item.table, item.column, item.clause); err != nil {
			return err
		}
	}

	indexSync := []struct {
		table  string
		name   string
		clause string
	}{
		{"clubs", "uk_clubs_name", "ADD UNIQUE KEY uk_clubs_name (name)"},
		{"teams", "uk_teams_user_id", "ADD UNIQUE KEY uk_teams_user_id (user_id)"},
		{"team_tactics", "uk_team_tactics_team_id", "ADD UNIQUE KEY uk_team_tactics_team_id (team_id)"},
		{"gacha_logs", "idx_gacha_logs_user_id", "ADD KEY idx_gacha_logs_user_id (user_id)"},
		{"gacha_logs", "idx_gacha_logs_banner_code", "ADD KEY idx_gacha_logs_banner_code (banner_code)"},
	}

	for _, item := range indexSync {
		if err := ensureIndex(ctx, db, item.table, item.name, item.clause); err != nil {
			return err
		}
	}

	foreignKeySync := []struct {
		table          string
		constraintName string
		column         string
		referenceTable string
		referenceCol   string
		clause         string
	}{
		{
			table:          "teams",
			constraintName: "fk_teams_user_id",
			column:         "user_id",
			referenceTable: "users",
			referenceCol:   "id",
			clause:         "ADD CONSTRAINT fk_teams_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE",
		},
		{
			table:          "user_players",
			constraintName: "fk_user_players_user_id",
			column:         "user_id",
			referenceTable: "users",
			referenceCol:   "id",
			clause:         "ADD CONSTRAINT fk_user_players_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE",
		},
		{
			table:          "user_players",
			constraintName: "fk_user_players_template_id",
			column:         "player_template_id",
			referenceTable: "player_templates",
			referenceCol:   "id",
			clause:         "ADD CONSTRAINT fk_user_players_template_id FOREIGN KEY (player_template_id) REFERENCES player_templates(id) ON DELETE RESTRICT ON UPDATE CASCADE",
		},
		{
			table:          "gacha_logs",
			constraintName: "fk_gacha_logs_user_id",
			column:         "user_id",
			referenceTable: "users",
			referenceCol:   "id",
			clause:         "ADD CONSTRAINT fk_gacha_logs_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE",
		},
		{
			table:          "gacha_logs",
			constraintName: "fk_gacha_logs_user_player_id",
			column:         "user_player_id",
			referenceTable: "user_players",
			referenceCol:   "id",
			clause:         "ADD CONSTRAINT fk_gacha_logs_user_player_id FOREIGN KEY (user_player_id) REFERENCES user_players(id) ON DELETE SET NULL ON UPDATE CASCADE",
		},
	}

	for _, item := range foreignKeySync {
		if err := ensureForeignKey(ctx, db, item.table, item.constraintName, item.column, item.referenceTable, item.referenceCol, item.clause); err != nil {
			return err
		}
	}

	checkConstraintSync := []struct {
		table          string
		constraintName string
		clause         string
	}{
		{
			table:          "user_players",
			constraintName: "ck_user_players_level",
			clause:         "ADD CONSTRAINT ck_user_players_level CHECK (level BETWEEN 1 AND 36)",
		},
	}

	for _, item := range checkConstraintSync {
		if err := ensureConstraint(ctx, db, item.table, item.constraintName, item.clause); err != nil {
			return err
		}
	}

	return nil
}

func ensureColumn(ctx context.Context, db *sql.DB, tableName, columnName, alterClause string) error {
	exists, err := hasColumn(ctx, db, tableName, columnName)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	query := fmt.Sprintf("ALTER TABLE `%s` %s", escapeIdentifier(tableName), alterClause)
	_, err = db.ExecContext(ctx, query)
	return err
}

func ensureIndex(ctx context.Context, db *sql.DB, tableName, indexName, alterClause string) error {
	exists, err := hasIndex(ctx, db, tableName, indexName)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	query := fmt.Sprintf("ALTER TABLE `%s` %s", escapeIdentifier(tableName), alterClause)
	_, err = db.ExecContext(ctx, query)
	return err
}

func ensureConstraint(ctx context.Context, db *sql.DB, tableName, constraintName, alterClause string) error {
	exists, err := hasConstraint(ctx, db, tableName, constraintName)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	query := fmt.Sprintf("ALTER TABLE `%s` %s", escapeIdentifier(tableName), alterClause)
	_, err = db.ExecContext(ctx, query)
	return err
}

func ensureForeignKey(ctx context.Context, db *sql.DB, tableName, constraintName, columnName, refTable, refColumn, alterClause string) error {
	exists, err := hasForeignKeyByDefinition(ctx, db, tableName, columnName, refTable, refColumn)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	return ensureConstraint(ctx, db, tableName, constraintName, alterClause)
}

func hasColumn(ctx context.Context, db *sql.DB, tableName, columnName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
	AND TABLE_NAME = ?
	AND COLUMN_NAME = ?`, tableName, columnName).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func hasIndex(ctx context.Context, db *sql.DB, tableName, indexName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
	AND TABLE_NAME = ?
	AND INDEX_NAME = ?`, tableName, indexName).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func hasConstraint(ctx context.Context, db *sql.DB, tableName, constraintName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
	AND TABLE_NAME = ?
	AND CONSTRAINT_NAME = ?`, tableName, constraintName).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func hasForeignKeyByDefinition(ctx context.Context, db *sql.DB, tableName, columnName, refTable, refColumn string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx, `
SELECT COUNT(*)
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
	AND TABLE_NAME = ?
	AND COLUMN_NAME = ?
	AND REFERENCED_TABLE_NAME = ?
	AND REFERENCED_COLUMN_NAME = ?`, tableName, columnName, refTable, refColumn).Scan(&count)
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
