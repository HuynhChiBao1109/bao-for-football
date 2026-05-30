import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class InitialServerSchema1717056000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "username", type: "varchar", length: "191", isUnique: true },
          { name: "password_hash", type: "varchar", length: "255" },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "countries",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "name", type: "varchar", length: "191" },
          { name: "code", type: "varchar", length: "16", isNullable: true },
          { name: "flag", type: "varchar", length: "512", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "leagues",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "name", type: "varchar", length: "191" },
          {
            name: "country_id",
            type: "bigint",
            unsigned: true,
            isNullable: true,
          },
          { name: "logo", type: "varchar", length: "512", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "clubs",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "name", type: "varchar", length: "191" },
          { name: "logo", type: "varchar", length: "512", isNullable: true },
          {
            name: "country_id",
            type: "bigint",
            unsigned: true,
            isNullable: true,
          },
          {
            name: "league_id",
            type: "bigint",
            unsigned: true,
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "teams",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "user_id", type: "bigint", unsigned: true },
          { name: "club_name", type: "varchar", length: "191" },
          { name: "image", type: "varchar", length: "512", isNullable: true },
          { name: "budget", type: "bigint", default: "360000000" },
          { name: "rank_point", type: "int", default: "0" },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "teams",
      new TableIndex({
        name: "IDX_teams_user_id",
        columnNames: ["user_id"],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "skills",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "name", type: "varchar", length: "191" },
          {
            name: "icon_url",
            type: "varchar",
            length: "512",
            isNullable: true,
          },
          { name: "buff_type", type: "varchar", length: "64" },
          { name: "buff_value", type: "int" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "player_templates",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "name", type: "varchar", length: "191" },
          {
            name: "image_url",
            type: "varchar",
            length: "512",
            isNullable: true,
          },
          {
            name: "base_club",
            type: "varchar",
            length: "191",
            isNullable: true,
          },
          { name: "season", type: "varchar", length: "64" },
          {
            name: "country_id",
            type: "bigint",
            unsigned: true,
            isNullable: true,
          },
          { name: "club_id", type: "bigint", unsigned: true, isNullable: true },
          { name: "base_pace", type: "int", default: "0" },
          { name: "base_passing", type: "int", default: "0" },
          { name: "base_long_pass", type: "int", default: "0" },
          { name: "base_vision", type: "int", default: "0" },
          { name: "base_shooting", type: "int", default: "0" },
          { name: "base_defending", type: "int", default: "0" },
          { name: "base_standing_tackle", type: "int", default: "0" },
          { name: "base_sliding_tackle", type: "int", default: "0" },
          { name: "base_physical", type: "int", default: "0" },
          { name: "base_dribbling", type: "int", default: "0" },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "player_positions",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "player_template_id", type: "bigint", unsigned: true },
          { name: "position", type: "varchar", length: "32" },
          { name: "effect", type: "double", default: "1" },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "player_positions",
      new TableIndex({
        name: "IDX_player_positions_template_position",
        columnNames: ["player_template_id", "position"],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "player_special_skills",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "player_template_id", type: "bigint", unsigned: true },
          { name: "skill_id", type: "bigint", unsigned: true },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "player_special_skills",
      new TableIndex({
        name: "IDX_player_special_skill_unique",
        columnNames: ["player_template_id", "skill_id"],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "user_players",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "user_id", type: "bigint", unsigned: true },
          { name: "player_template_id", type: "bigint", unsigned: true },
          { name: "level", type: "int", default: "1" },
          { name: "exp", type: "int", default: "0" },
          { name: "current_points", type: "int", default: "0" },
          { name: "bonus_shooting", type: "int", default: "0" },
          { name: "bonus_passing", type: "int", default: "0" },
          { name: "bonus_long_pass", type: "int", default: "0" },
          { name: "bonus_vision", type: "int", default: "0" },
          { name: "bonus_gk_reach", type: "int", default: "0" },
          { name: "bonus_counter_attack_awareness", type: "int", default: "0" },
          { name: "bonus_defending", type: "int", default: "0" },
          { name: "bonus_gk_parrying", type: "int", default: "0" },
          { name: "bonus_gk_reflex", type: "int", default: "0" },
          { name: "bonus_duels", type: "int", default: "0" },
          { name: "bonus_pace", type: "int", default: "0" },
          { name: "bonus_stamina", type: "int", default: "0" },
          { name: "bonus_balance", type: "int", default: "0" },
          { name: "bonus_technique", type: "int", default: "0" },
          { name: "bonus_determination", type: "int", default: "0" },
          { name: "bonus_physical", type: "int", default: "0" },
          { name: "bonus_standing_tackle", type: "int", default: "0" },
          { name: "bonus_sliding_tackle", type: "int", default: "0" },
          { name: "bonus_dribbling", type: "int", default: "0" },
          { name: "bonus_curve", type: "int", default: "0" },
          {
            name: "obtained_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "gacha_banners",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "banner_code", type: "varchar", length: "64" },
          { name: "banner_name", type: "varchar", length: "191" },
          { name: "banner_image_url", type: "varchar", length: "512" },
          { name: "player_id", type: "bigint", unsigned: true },
          { name: "expired_at", type: "datetime" },
          { name: "status", type: "int", default: "1" },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "gacha_logs",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "user_id", type: "bigint", unsigned: true },
          { name: "banner_code", type: "varchar", length: "64" },
          { name: "rarity", type: "varchar", length: "16" },
          { name: "is_pity_triggered", type: "tinyint", default: "0" },
          { name: "total_rolls", type: "int", default: "0" },
          { name: "rolls_since_last_special", type: "int", default: "0" },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "team_tactics",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "team_id", type: "varchar", length: "32" },
          { name: "formation", type: "varchar", length: "10" },
          { name: "pass_ratio", type: "double" },
          { name: "shot_ratio", type: "double" },
          { name: "pressure", type: "double" },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "team_tactics",
      new TableIndex({
        name: "IDX_team_tactics_team_id",
        columnNames: ["team_id"],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "team_lineups",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "team_id", type: "varchar", length: "32" },
          { name: "slot_id", type: "varchar", length: "32" },
          { name: "position", type: "varchar", length: "10" },
          { name: "user_player_id", type: "bigint", unsigned: true },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "team_lineups",
      new TableIndex({
        name: "IDX_team_lineups_team_slot",
        columnNames: ["team_id", "slot_id"],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "matches",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "match_id", type: "varchar", length: "64", isUnique: true },
          { name: "user_id", type: "bigint", unsigned: true },
          { name: "home_club_name", type: "varchar", length: "191" },
          { name: "away_club_name", type: "varchar", length: "191" },
          { name: "mode", type: "varchar", length: "64", default: "'casual'" },
          { name: "stage_no", type: "int", isNullable: true },
          {
            name: "status",
            type: "varchar",
            length: "32",
            default: "'running'",
          },
          { name: "home_score", type: "int", isNullable: true },
          { name: "away_score", type: "int", isNullable: true },
          { name: "home_stats", type: "text", isNullable: true },
          { name: "away_stats", type: "text", isNullable: true },
          {
            name: "started_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          { name: "ended_at", type: "timestamp", isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "user_stages",
        columns: [
          {
            name: "id",
            type: "bigint",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
            unsigned: true,
          },
          { name: "user_id", type: "bigint", unsigned: true },
          { name: "stage_no", type: "int" },
          { name: "club_id", type: "bigint", unsigned: true },
          { name: "club_name", type: "varchar", length: "191" },
          { name: "reward_money", type: "bigint", default: "0" },
          { name: "reward_exp", type: "int", default: "0" },
          { name: "enemy_stat_bonus", type: "int", default: "0" },
          { name: "is_unlocked", type: "tinyint", default: "0" },
          { name: "is_cleared", type: "tinyint", default: "0" },
          { name: "attempts", type: "int", default: "0" },
          { name: "wins", type: "int", default: "0" },
          { name: "unlocked_at", type: "timestamp", isNullable: true },
          { name: "last_cleared_at", type: "timestamp", isNullable: true },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      "user_stages",
      new TableIndex({
        name: "IDX_user_stages_user_stage",
        columnNames: ["user_id", "stage_no"],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("user_stages", true);
    await queryRunner.dropTable("matches", true);
    await queryRunner.dropTable("team_lineups", true);
    await queryRunner.dropTable("team_tactics", true);
    await queryRunner.dropTable("gacha_logs", true);
    await queryRunner.dropTable("gacha_banners", true);
    await queryRunner.dropTable("user_players", true);
    await queryRunner.dropTable("player_positions", true);
    await queryRunner.dropTable("player_special_skills", true);
    await queryRunner.dropTable("player_templates", true);
    await queryRunner.dropTable("skills", true);
    await queryRunner.dropTable("teams", true);
    await queryRunner.dropTable("clubs", true);
    await queryRunner.dropTable("leagues", true);
    await queryRunner.dropTable("countries", true);
    await queryRunner.dropTable("users", true);
  }
}
