import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("countries")
export class CountryEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ type: "varchar", length: 191 })
  name!: string;

  @Column({ type: "varchar", length: 16, nullable: true })
  code!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  flag!: string | null;
}

@Entity("leagues")
export class LeagueEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ type: "varchar", length: 191 })
  name!: string;

  @Column({
    name: "country_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  countryId!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  logo!: string | null;
}

@Entity("skills")
export class SkillEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ type: "varchar", length: 191 })
  name!: string;

  @Column({ name: "icon_url", type: "varchar", length: 512, nullable: true })
  iconUrl!: string | null;

  @Column({ name: "buff_type", type: "varchar", length: 64 })
  buffType!: string;

  @Column({ name: "buff_value", type: "int" })
  buffValue!: number;
}

@Entity("player_templates")
@Unique(["name", "season"])
export class PlayerTemplateEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ type: "varchar", length: 191 })
  name!: string;

  @Column({ name: "avatar_url", type: "varchar", length: 512, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: "base_club", type: "varchar", length: 191, nullable: true })
  baseClub!: string | null;

  @Column({ type: "varchar", length: 64 })
  season!: string;

  @Column({
    name: "country_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  countryId!: string | null;

  @Column({ name: "club_id", type: "bigint", unsigned: true, nullable: true })
  clubId!: string | null;

  @Column({ name: "positions_json", type: "text", nullable: true })
  positionsJson!: string | null;

  @Column({ name: "base_pace", type: "int", default: 0 })
  basePace!: number;

  @Column({ name: "base_passing", type: "int", default: 0 })
  basePassing!: number;

  @Column({ name: "base_long_pass", type: "int", default: 0 })
  baseLongPass!: number;

  @Column({ name: "base_vision", type: "int", default: 0 })
  baseVision!: number;

  @Column({ name: "base_shooting", type: "int", default: 0 })
  baseShooting!: number;

  @Column({ name: "base_defending", type: "int", default: 0 })
  baseDefending!: number;

  @Column({ name: "base_standing_tackle", type: "int", default: 0 })
  baseStandingTackle!: number;

  @Column({ name: "base_sliding_tackle", type: "int", default: 0 })
  baseSlidingTackle!: number;

  @Column({ name: "base_physical", type: "int", default: 0 })
  basePhysical!: number;

  @Column({ name: "base_dribbling", type: "int", default: 0 })
  baseDribbling!: number;
}

@Entity("player_special_skills")
@Unique(["playerTemplateId", "skillId"])
export class PlayerSpecialSkillEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "player_template_id", type: "bigint", unsigned: true })
  playerTemplateId!: string;

  @Column({ name: "skill_id", type: "bigint", unsigned: true })
  skillId!: string;
}
