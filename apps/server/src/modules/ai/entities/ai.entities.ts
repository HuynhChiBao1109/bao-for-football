import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("user_stages")
@Unique(["userId", "stageNo"])
export class UserStageEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "stage_no", type: "int" })
  stageNo!: number;

  @Column({ name: "club_id", type: "bigint", unsigned: true })
  clubId!: string;

  @Column({ name: "club_name", type: "varchar", length: 191 })
  clubName!: string;

  @Column({ name: "reward_money", type: "bigint", default: 0 })
  rewardMoney!: string;

  @Column({ name: "reward_exp", type: "int", default: 0 })
  rewardExp!: number;

  @Column({ name: "enemy_stat_bonus", type: "int", default: 0 })
  enemyStatBonus!: number;

  @Column({ name: "is_unlocked", type: "tinyint", width: 1, default: 0 })
  isUnlocked!: boolean;

  @Column({ name: "is_cleared", type: "tinyint", width: 1, default: 0 })
  isCleared!: boolean;

  @Column({ type: "int", default: 0 })
  attempts!: number;

  @Column({ type: "int", default: 0 })
  wins!: number;

  @Column({ name: "unlocked_at", type: "timestamp", nullable: true })
  unlockedAt!: Date | null;

  @Column({ name: "last_cleared_at", type: "timestamp", nullable: true })
  lastClearedAt!: Date | null;

  @CreateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt!: Date;
}
