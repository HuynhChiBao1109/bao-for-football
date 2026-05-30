import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerBody } from "../types/player-body.enum";
import { EPlayerPosition } from "../types/player-position.enum";

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

  @Column({ name: "height", type: "int", default: 180 })
  height!: number;

  @Column({
    name: "body_type",
    type: "enum",
    enum: EPlayerBody,
    default: EPlayerBody.NORMAL,
  })
  bodyType!: EPlayerBody;

  @Column({ name: "pass", type: "int", default: 75 })
  pass!: number;

  @Column({ name: "long_pass", type: "int", default: 75 })
  longPass!: number;

  @Column({ name: "vision", type: "int", default: 75 })
  vision!: number;

  @Column({ name: "shoot", type: "int", default: 75 })
  shoot!: number;

  @Column({ name: "tackle", type: "int", default: 75 })
  tackle!: number;

  @Column({ name: "balance", type: "int", default: 75 })
  balance!: number;

  @Column({ name: "dribbling", type: "int", default: 75 })
  dribbling!: number;
}

@Entity("player_special_skills")
@Unique(["playerTemplateId", "skilCode"])
export class PlayerSpecialSkillEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "player_template_id", type: "bigint", unsigned: true })
  playerTemplateId!: string;

  @Column({ name: "skil_code", type: "bigint", unsigned: true })
  skilCode!: string;
}

@Entity("player_positions")
@Unique(["playerTemplateId", "positionCode"])
export class PlayerPositionEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "player_template_id", type: "bigint", unsigned: true })
  playerTemplateId!: string;

  @Column({
    name: "position_code",
    type: "enum",
    enum: EPlayerPosition,
    unsigned: true,
  })
  position!: string;
}
