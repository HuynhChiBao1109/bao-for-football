import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerSkill } from "../types/player-skill.enum";
import { TeamEntity } from "src/modules/team/entities/team.entities";
import { UserEntity } from "src/modules/user/user.entities";

@Entity("user_players")
export class UserPlayerEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId: bigint;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: bigint;

  @Column({ type: "int", default: 0 })
  exp!: number;

  @Column({ name: "bonus_attack", type: "int", default: 0 })
  bonusAttack!: number;

  @Column({ name: "bonus_defense", type: "int", default: 0 })
  bonusDefense!: number;

  @Column({ name: "bonus_agility", type: "int", default: 0 })
  bonusAgility!: number;

  @Column({ name: "bonus_pass", type: "int", default: 0 })
  bonusPass!: number;

  @Column({ name: "bonus_goalkeeping", type: "int", default: 0 })
  bonusGoalkeeping!: number;
  
  @ManyToOne(() => UserPlayerSkillEntity, (skill) => skill.userPlayerId)
  skills: UserPlayerSkillEntity[];

  @ManyToOne(() => UserEntity, (player) => player.id, { onDelete: "CASCADE" })
  user: UserEntity;

  @OneToOne(() => TeamEntity, (team) => team.id)
  team: TeamEntity;
}

@Entity("user_player_skills")
@Unique(["userPlayerId", "skill"])
export class UserPlayerSkillEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "user_player_id", type: "bigint", unsigned: true })
  userPlayerId: bigint;

  @Column({ name: "skill", type: "enum", enum: EPlayerSkill })
  skill: EPlayerSkill;
  
  @ManyToOne(() => UserPlayerEntity, (player) => player.skills, { onDelete: "CASCADE" })
  userPlayer: UserPlayerEntity;
}
