import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerBody } from "../types/player-body.enum";
import { EPlayerPosition } from "../types/player-position.enum";
import { IsEnum } from "class-validator";
import { EPlayerSkill } from "../types/player-skill.enum";

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

@Entity("players")
@Unique(["name", "season"])
export class PlayerTemplateEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: string;

  @Column({ type: "varchar", length: 191 })
  name!: string;

  @Column({ type: "varchar", length: 64, default: "normal" })
  season!: string;

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

  @Column({ name: "acceleration", type: "int", default: 75 })
  acceleration!: number;

  @Column({ name: "speed", type: "int", default: 75 })
  speed!: number;

  @Column({ name: "stamina", type: "int", default: 75 })
  stamina!: number;

  @OneToMany(() => PlayerPositionEntity, (position) => position.playerId)
  positions!: PlayerPositionEntity[];

  @OneToMany(() => PlayerSkillEntity, (skill) => skill.playerId)
  skills!: PlayerSkillEntity[];
}

@Entity("player_positions")
@Unique(["playerId", "position"])
export class PlayerPositionEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: string;

  @Column({
    name: "position",
    type: "enum",
    enum: EPlayerPosition,
  })
  @IsEnum(EPlayerPosition)
  position!: EPlayerPosition;
}

@Entity("player_skills")
@Unique(["playerId", "skill"])
export class PlayerSkillEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: string;

  @Column({
    name: "skill",
    type: "enum",
    enum: EPlayerSkill,
  })
  @IsEnum(EPlayerSkill)
  skill!: EPlayerSkill;
}
