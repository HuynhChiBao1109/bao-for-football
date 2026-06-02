import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("player_users")
export class UserPlayerEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId!: string;

  @Column({ type: "int", default: 0 })
  exp!: number;

  @Column({ name: "bonus_attack", type: "int", default: 75 })
  bonusAttack!: number;

  @Column({ name: "bonus_defense", type: "int", default: 75 })
  bonusDefense!: number;

  @Column({ name: "bonus_agility", type: "int", default: 75 })
  bonusAgility!: number;

  @Column({ name: "bonus_pass", type: "int", default: 75 })
  bonusPass!: number;

  @Column({ name: "bonus_goalkeeping", type: "int", default: 75 })
  bonusGoalkeeping!: number;
}
