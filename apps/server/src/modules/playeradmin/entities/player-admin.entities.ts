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

  @Column({
    name: "country_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  countryId!: string | null;

  @Column({ name: "club_id", type: "bigint", unsigned: true, nullable: true })
  clubId!: string | null;

  @Column({ name: "height", type: "int", default: 0 })
  height!: number;

  @Column({ name: "body_type", type: "int", default: 0 })
  bodyType!: number;

  @Column({ name: "pass", type: "int", default: 0 })
  pass!: number;

  @Column({ name: "long_pass", type: "int", default: 0 })
  longPass!: number;

  @Column({ name: "vision", type: "int", default: 0 })
  vision!: number;

  @Column({ name: "shoot", type: "int", default: 0 })
  shoot!: number;

  @Column({ name: "tackle", type: "int", default: 0 })
  tackle!: number;

  @Column({ name: "balance", type: "int", default: 0 })
  balance!: number;

  @Column({ name: "dribbling", type: "int", default: 0 })
  dribbling!: number;
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
