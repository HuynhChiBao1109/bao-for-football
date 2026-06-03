import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerBody } from "../enum/player-body.enum";
import { EPlayerPosition } from "../enum/player-position.enum";
import { IsEnum } from "class-validator";
import { EPlayerSkill } from "../enum/player-skill.enum";
import { EPlayerSeason } from "../enum/player-season.enum";
import { ClubEntity } from "./club.entites";
import { CountryEntity } from "./country.entities";
import { AbstractEntity } from "src/database/database.abjact";
import { PlayerPositionFormat } from "../types/player-position-format.type";

@Entity("players")
@Unique(["name", "season"])
export class PlayerEntity extends AbstractEntity {
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

  @Column({ name: "gk_keeping", type: "int", default: 75 })
  gkKeeping: number;

  @Column({ name: "gk_reflex", type: "int", default: 75 })
  gkReflex: number;

  @Column({ name: "gk_diving", type: "int", default: 75 })
  gkDiving: number;

  @Column({ name: "gk_reach", type: "int", default: 75 })
  gkReach: number;

  @Column({ name: "positions", type: "json" })
  positions: PlayerPositionFormat[];

  @ManyToOne(() => CountryEntity, { nullable: true })
  @JoinColumn({ name: "country_id" })
  country: CountryEntity | null;

  @ManyToOne(() => ClubEntity, { nullable: true })
  @JoinColumn({ name: "club_id" })
  club: ClubEntity | null;

  @OneToMany(() => PlayerSkillEntity, (skill) => skill.player, {
    cascade: true,
  })
  skills: PlayerSkillEntity[];
}

@Entity("player_skills")
@Unique(["playerId", "skill"])
export class PlayerSkillEntity extends AbstractEntity {
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
