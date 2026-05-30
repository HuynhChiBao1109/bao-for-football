import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("user_players")
export class UserPlayerEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "player_template_id", type: "bigint", unsigned: true })
  playerTemplateId!: string;

  @Column({ type: "int", default: 1 })
  level!: number;

  @Column({ type: "int", default: 0 })
  exp!: number;

  @Column({ name: "current_points", type: "int", default: 0 })
  currentPoints!: number;

  @Column({ name: "bonus_shooting", type: "int", default: 0 })
  bonusShooting!: number;

  @Column({ name: "bonus_passing", type: "int", default: 0 })
  bonusPassing!: number;

  @Column({ name: "bonus_long_pass", type: "int", default: 0 })
  bonusLongPass!: number;

  @Column({ name: "bonus_vision", type: "int", default: 0 })
  bonusVision!: number;

  @Column({ name: "bonus_gk_reach", type: "int", default: 0 })
  bonusGkReach!: number;

  @Column({ name: "bonus_counter_attack_awareness", type: "int", default: 0 })
  bonusCounterAttackAwareness!: number;

  @Column({ name: "bonus_defending", type: "int", default: 0 })
  bonusDefending!: number;

  @Column({ name: "bonus_gk_parrying", type: "int", default: 0 })
  bonusGkParrying!: number;

  @Column({ name: "bonus_gk_reflex", type: "int", default: 0 })
  bonusGkReflex!: number;

  @Column({ name: "bonus_duels", type: "int", default: 0 })
  bonusDuels!: number;

  @Column({ name: "bonus_pace", type: "int", default: 0 })
  bonusPace!: number;

  @Column({ name: "bonus_stamina", type: "int", default: 0 })
  bonusStamina!: number;

  @Column({ name: "bonus_balance", type: "int", default: 0 })
  bonusBalance!: number;

  @Column({ name: "bonus_technique", type: "int", default: 0 })
  bonusTechnique!: number;

  @Column({ name: "bonus_determination", type: "int", default: 0 })
  bonusDetermination!: number;

  @Column({ name: "bonus_physical", type: "int", default: 0 })
  bonusPhysical!: number;

  @Column({ name: "bonus_standing_tackle", type: "int", default: 0 })
  bonusStandingTackle!: number;

  @Column({ name: "bonus_sliding_tackle", type: "int", default: 0 })
  bonusSlidingTackle!: number;

  @Column({ name: "bonus_dribbling", type: "int", default: 0 })
  bonusDribbling!: number;

  @Column({ name: "bonus_curve", type: "int", default: 0 })
  bonusCurve!: number;

  @CreateDateColumn({ name: "obtained_at", type: "timestamp" })
  obtainedAt!: Date;
}
