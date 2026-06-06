import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerSkill } from "../enum/player-skill.enum";
import { UserEntity } from "src/modules/user/entities/user.entity";
import { PlayerPositionFormat } from "../types/player-position-format.type";

@Entity("user_players")
export class UserPlayerEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ name: "user_id", type: "int", unsigned: true })
  userId: number;

  @Column({ name: "player_id", type: "int", unsigned: true })
  playerId: number;

  @Column({ type: "int", default: 0 })
  exp: number;

  @Column({ name: "bonus_attack", type: "int", default: 0 })
  bonusAttack: number;

  @Column({ name: "bonus_defense", type: "int", default: 0 })
  bonusDefense: number;

  @Column({ name: "bonus_agility", type: "int", default: 0 })
  bonusAgility: number;

  @Column({ name: "bonus_pass", type: "int", default: 0 })
  bonusPass: number;

  @Column({ name: "bonus_goalkeeping", type: "int", default: 0 })
  bonusGoalkeeping: number;

  @Column({ name: "positions", type: "json" })
  positions: PlayerPositionFormat[];

  @OneToMany(() => UserPlayerSkillEntity, (skill) => skill.userPlayer)
  skills: UserPlayerSkillEntity[];

  @ManyToOne(() => UserEntity, (user) => user.id, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserEntity;
}

@Entity("user_player_skills")
@Unique(["userPlayerId", "skill"])
export class UserPlayerSkillEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ name: "user_player_id", type: "int", unsigned: true })
  userPlayerId: number;

  @Column({ name: "skill", type: "enum", enum: EPlayerSkill })
  skill: EPlayerSkill;

  @ManyToOne(() => UserPlayerEntity, (player) => player.skills, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_player_id" })
  userPlayer: UserPlayerEntity;
}
