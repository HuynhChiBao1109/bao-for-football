-- FIFAM MySQL schema for card-based football management
-- Target: MySQL 8+

CREATE DATABASE IF NOT EXISTS fifam_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fifam_dev;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS gacha_logs;
DROP TABLE IF EXISTS match_scorers;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS user_players;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS player_templates;
DROP TABLE IF EXISTS admin_players;
DROP TABLE IF EXISTS countries;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username)
) ENGINE=InnoDB;

CREATE TABLE teams (
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
) ENGINE=InnoDB;

CREATE TABLE countries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(20) NULL,
  flag VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_countries_name (name)
) ENGINE=InnoDB;

CREATE TABLE admin_players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  country_id BIGINT UNSIGNED NULL,
  nationality VARCHAR(80) NOT NULL,
  base_club VARCHAR(120) NOT NULL,
  season ENUM('Normal', 'Special') NOT NULL DEFAULT 'Normal',
  source_type ENUM('normal', 'gacha') NOT NULL DEFAULT 'normal',
  special_skill VARCHAR(120) NOT NULL DEFAULT '',
  shooting SMALLINT UNSIGNED NOT NULL,
  passing SMALLINT UNSIGNED NOT NULL,
  long_pass SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  vision SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  defensive_awareness SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  counter_attack_awareness SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  crossbar_handling SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  reflexes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  aerial_catching SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  duels SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  pace SMALLINT UNSIGNED NOT NULL,
  physical SMALLINT UNSIGNED NOT NULL,
  defending SMALLINT UNSIGNED NOT NULL,
  standing_tackle SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  sliding_tackle SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  dribbling SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_players_season (season),
  KEY idx_admin_players_source_type (source_type),
  KEY idx_admin_players_country_id (country_id),
  CONSTRAINT fk_admin_players_country_id
    FOREIGN KEY (country_id) REFERENCES countries(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE player_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  height_cm SMALLINT UNSIGNED NOT NULL,
  country_id BIGINT UNSIGNED NULL,
  nationality VARCHAR(80) NOT NULL,
  base_club VARCHAR(120) NOT NULL,
  season ENUM('Normal', 'Special') NOT NULL DEFAULT 'Normal',
  image_url VARCHAR(500) NULL,
  base_shooting SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_passing SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_long_pass SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_vision SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_defensive_awareness SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_counter_attack_awareness SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_crossbar_handling SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_reflexes SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_aerial_catching SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_duels SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_pace SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_physical SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_defending SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_standing_tackle SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_sliding_tackle SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  base_dribbling SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_player_templates_season (season),
  KEY idx_player_templates_name (name),
  KEY idx_player_templates_country_id (country_id),
  CONSTRAINT fk_player_templates_country_id
    FOREIGN KEY (country_id) REFERENCES countries(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE skills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  icon_url VARCHAR(500) NULL,
  buff_type ENUM('shooting', 'passing', 'longPass', 'vision', 'defensiveAwareness', 'counterAttackAwareness', 'crossbarHandling', 'reflexes', 'aerialCatching', 'duels', 'pace', 'physical', 'defending', 'standingTackle', 'slidingTackle', 'dribbling') NOT NULL,
  buff_value SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_skills_name (name)
) ENGINE=InnoDB;

CREATE TABLE user_players (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  player_template_id BIGINT UNSIGNED NOT NULL,
  level TINYINT UNSIGNED NOT NULL DEFAULT 1,
  exp INT UNSIGNED NOT NULL DEFAULT 0,
  current_points INT UNSIGNED NOT NULL DEFAULT 0,
  bonus_shooting SMALLINT NOT NULL DEFAULT 0,
  bonus_passing SMALLINT NOT NULL DEFAULT 0,
  bonus_long_pass SMALLINT NOT NULL DEFAULT 0,
  bonus_vision SMALLINT NOT NULL DEFAULT 0,
  bonus_defensive_awareness SMALLINT NOT NULL DEFAULT 0,
  bonus_counter_attack_awareness SMALLINT NOT NULL DEFAULT 0,
  bonus_crossbar_handling SMALLINT NOT NULL DEFAULT 0,
  bonus_reflexes SMALLINT NOT NULL DEFAULT 0,
  bonus_aerial_catching SMALLINT NOT NULL DEFAULT 0,
  bonus_duels SMALLINT NOT NULL DEFAULT 0,
  bonus_pace SMALLINT NOT NULL DEFAULT 0,
  bonus_physical SMALLINT NOT NULL DEFAULT 0,
  bonus_defending SMALLINT NOT NULL DEFAULT 0,
  bonus_standing_tackle SMALLINT NOT NULL DEFAULT 0,
  bonus_sliding_tackle SMALLINT NOT NULL DEFAULT 0,
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
) ENGINE=InnoDB;

CREATE TABLE gacha_logs (
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
) ENGINE=InnoDB;

CREATE TABLE matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_uuid CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  home_club_name VARCHAR(120) NOT NULL,
  away_club_name VARCHAR(120) NOT NULL,
  home_score INT NOT NULL DEFAULT 0,
  away_score INT NOT NULL DEFAULT 0,
  mode VARCHAR(32) NOT NULL DEFAULT 'casual',
  stage_no INT NULL,
  status ENUM('running', 'finished') NOT NULL DEFAULT 'running',
  home_stats JSON NULL,
  away_stats JSON NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_matches_match_uuid (match_uuid),
  KEY idx_matches_user_id (user_id),
  CONSTRAINT fk_matches_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE match_scorers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_id BIGINT UNSIGNED NOT NULL,
  team_side ENUM('home', 'away') NOT NULL,
  player_id INT NOT NULL,
  player_name VARCHAR(120) NULL,
  minute INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_match_scorers_match_id (match_id),
  CONSTRAINT fk_match_scorers_match_id
    FOREIGN KEY (match_id) REFERENCES matches(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER trg_user_players_limit_before_insert
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
END $$

DELIMITER ;
