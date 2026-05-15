-- FIFAM MySQL schema for card-based football management
-- Target: MySQL 8+

CREATE DATABASE IF NOT EXISTS fifam_dev
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fifam_dev;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS gacha_logs;
DROP TABLE IF EXISTS user_players;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS player_templates;
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

CREATE TABLE player_templates (
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
) ENGINE=InnoDB;

CREATE TABLE skills (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  icon_url VARCHAR(500) NULL,
  buff_type ENUM('shooting', 'passing', 'pace', 'physical', 'defending', 'dribbling') NOT NULL,
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
