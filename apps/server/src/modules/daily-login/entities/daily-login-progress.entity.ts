import { AbstractEntity } from "src/database/database.abjact";
import { UserEntity } from "src/modules/user/entities/user.entity";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("daily_login_progress")
@Unique("UQ_daily_login_progress_user", ["userId"])
export class DailyLoginProgressEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ name: "user_id", type: "int", unsigned: true })
  userId: number;

  @Column({ name: "claimed_days", type: "tinyint", unsigned: true, default: 0 })
  claimedDays: number;

  @Column({ name: "last_claim_date", type: "date", nullable: true })
  lastClaimDate: string | null;

  @Column({ name: "completed_at", type: "timestamp", nullable: true })
  completedAt: Date | null;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserEntity;
}
