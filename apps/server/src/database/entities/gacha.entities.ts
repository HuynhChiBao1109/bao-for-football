import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("gacha_banners")
export class GachaBannerEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "banner_code", type: "varchar", length: 64 })
  bannerCode!: string;

  @Column({ name: "banner_name", type: "varchar", length: 191 })
  bannerName!: string;

  @Column({ name: "banner_image_url", type: "varchar", length: 512 })
  bannerImageUrl!: string;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId!: string;

  @Column({ name: "expired_at", type: "datetime" })
  expiredAt!: Date;

  @Column({ type: "int", default: 1 })
  status!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}

@Entity("gacha_logs")
export class GachaLogEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "banner_code", type: "varchar", length: 64 })
  bannerCode!: string;

  @Column({ type: "varchar", length: 16 })
  rarity!: string;

  @Column({ name: "is_pity_triggered", type: "tinyint", width: 1, default: 0 })
  isPityTriggered!: boolean;

  @Column({ name: "total_rolls", type: "int", default: 0 })
  totalRolls!: number;

  @Column({ name: "rolls_since_last_special", type: "int", default: 0 })
  rollsSinceLastSpecial!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}
