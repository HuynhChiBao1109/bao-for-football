import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity("matches")
export class MatchEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "match_id", type: "varchar", length: 64, unique: true })
  matchId!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "home_club_name", type: "varchar", length: 191 })
  homeClubName!: string;

  @Column({ name: "away_club_name", type: "varchar", length: 191 })
  awayClubName!: string;

  @Column({ type: "varchar", length: 64, default: "casual" })
  mode!: string;

  @Column({ name: "stage_no", type: "int", nullable: true })
  stageNo!: number | null;

  @Column({ type: "varchar", length: 32, default: "running" })
  status!: string;

  @Column({ name: "home_score", type: "int", nullable: true })
  homeScore!: number | null;

  @Column({ name: "away_score", type: "int", nullable: true })
  awayScore!: number | null;

  @Column({ name: "home_stats", type: "simple-json", nullable: true })
  homeStats!: Record<string, any> | null;

  @Column({ name: "away_stats", type: "simple-json", nullable: true })
  awayStats!: Record<string, any> | null;

  @CreateDateColumn({ name: "started_at", type: "timestamp" })
  startedAt!: Date;

  @Column({ name: "ended_at", type: "timestamp", nullable: true })
  endedAt!: Date | null;
}
