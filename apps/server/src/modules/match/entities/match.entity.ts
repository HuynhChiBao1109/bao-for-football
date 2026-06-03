import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { EMatchStatus } from "../enums/match-status.enum";
import { CampainMatchEntity } from "src/modules/campain/entities/campain-match.entity";

@Entity("matches")
export class MatchEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "campain_id", type: "bigint", unsigned: true })
  campainId!: bigint;

  @Column({ type: "enum", enum: EMatchStatus, default: EMatchStatus.IN_PROGRESS })
  status: EMatchStatus;

  @Column({ name: "home_score", type: "int", nullable: true })
  homeScore: number | null;

  @Column({ name: "away_score", type: "int", nullable: true })
  awayScore: number | null;

  @CreateDateColumn({ name: "started_at", type: "timestamp" })
  startedAt: Date;

  @Column({ name: "ended_at", type: "timestamp", nullable: true })
  endedAt: Date | null;

  @OneToOne(() => CampainMatchEntity, (campainMatch) => campainMatch.match)
  @JoinColumn({ name: "campain_id" })
  campainMatch: CampainMatchEntity;
}
