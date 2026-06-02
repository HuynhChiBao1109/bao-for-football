import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerBody } from "../types/player-body.enum";
import { EPlayerPosition } from "../types/player-position.enum";
import { IsEnum } from "class-validator";
import { EPlayerSkill } from "../types/player-skill.enum";
import { EPlayerSeason } from "../types/player-season.enum";
import { CountryEntity } from "./club.entites";
import { ClubEntity } from "./country.entities";

@Entity("players")
@Unique(["name", "season"])
export class PlayerEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ type: "varchar", length: 191 })
  name: string;

  @Column({
    name: "season",
    type: "enum",
    enum: EPlayerSeason,
  })
  @IsEnum(EPlayerSeason)
  season: EPlayerSeason;

  @Column({ name: "avatar_url", type: "varchar", length: 512, nullable: true })
  avatarUrl: string | null;

  @Column({
    name: "country_id",
    type: "bigint",
    unsigned: true,
  })
  countryId: bigint | null;

  @Column({ name: "club_id", type: "bigint", unsigned: true, nullable: true })
  clubId: bigint | null;

  @Column({ name: "height", type: "int", default: 180 })
  height!: number;

  @Column({
    name: "body_type",
    type: "enum",
    enum: EPlayerBody,
    default: EPlayerBody.NORMAL,
  })
  bodyType: EPlayerBody;

  @Column({ name: "pass", type: "int", default: 75 })
  pass: number;

  @Column({ name: "long_pass", type: "int", default: 75 })
  longPass: number;

  @Column({ name: "vision", type: "int", default: 75 })
  vision: number;

  @Column({ name: "shoot", type: "int", default: 75 })
  shoot: number;

  @Column({ name: "tackle", type: "int", default: 75 })
  tackle: number;

  @Column({ name: "balance", type: "int", default: 75 })
  balance: number;

  @Column({ name: "dribbling", type: "int", default: 75 })
  dribbling: number;

  @Column({ name: "acceleration", type: "int", default: 75 })
  acceleration: number;

  @Column({ name: "speed", type: "int", default: 75 })
  speed: number;

  @Column({ name: "stamina", type: "int", default: 75 })
  stamina: number;

  @ManyToOne(() => CountryEntity, { nullable: true })
  @JoinColumn({ name: "country_id" })
  country: CountryEntity | null;

  @ManyToOne(() => ClubEntity, { nullable: true })
  @JoinColumn({ name: "club_id" })
  club: ClubEntity | null;

  @OneToMany(() => PlayerPositionEntity, (position) => position.player, {
    cascade: true,
  })
  positions: PlayerPositionEntity[];

  @OneToMany(() => PlayerSkillEntity, (skill) => skill.player, {
    cascade: true,
  })
  skills: PlayerSkillEntity[];
}

@Entity("player_positions")
@Unique(["playerId", "position"])
export class PlayerPositionEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: bigint;

  @Column({
    name: "position",
    type: "enum",
    enum: EPlayerPosition,
  })
  @IsEnum(EPlayerPosition)
  position: EPlayerPosition;

  @ManyToOne(() => PlayerEntity, (player) => player.positions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "player_id" })
  player: PlayerEntity;
}

@Entity("player_skills")
@Unique(["playerId", "skill"])
export class PlayerSkillEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: bigint;

  @Column({
    name: "skill",
    type: "enum",
    enum: EPlayerSkill,
  })
  @IsEnum(EPlayerSkill)
  skill: EPlayerSkill;

  @ManyToOne(() => PlayerEntity, (player) => player.skills, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "player_id" })
  player: PlayerEntity;
}
