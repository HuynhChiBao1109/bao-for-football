import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("player_users")
export class UserPlayerEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "player_template_id", type: "bigint", unsigned: true })
  playerTemplateId!: string;

  @Column({ type: "int", default: 0 })
  exp!: number;

  @Column({ name: "current_points", type: "int", default: 0 })
  currentPoints!: number;

  @Column({ name: "bonus_pass", type: "int", default: 75 })
  bonusPass!: number;

  @Column({ name: "bonus_long_pass", type: "int", default: 75 })
  bonusLongPass!: number;

  @Column({ name: "bonus_vision", type: "int", default: 75 })
  bonusVision!: number;

  @Column({ name: "bonus_shoot", type: "int", default: 75 })
  bonusShoot!: number;

  @Column({ name: "bonus_tackle", type: "int", default: 75 })
  bonusTackle!: number;

  @Column({ name: "bonus_balance", type: "int", default: 75 })
  bonusBalance!: number;

  @Column({ name: "bonus_dribbling", type: "int", default: 75 })
  bonusDribbling!: number;

  @Column({ name: "bonus_stamina", type: "int", default: 75 })
  bonusStamina!: number;

  @Column({ name: "bonus_speed", type: "int", default: 75 })
  bonusSpeed!: number;

  @CreateDateColumn({
    name: "created_at",
    type: "timestamp",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp",
  })
  updatedAt: Date;
}
