import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { EMatchStatus } from "../enums/match-status.enum";
import { CampainMatchEntity } from "src/modules/campain/entities/campain-match.entity";
import { MatchEventEntity } from "./match-event.entity";
import { MatchPlayerStatsEntity } from "./match-player-stats.entity";
import { TeamEntity } from "src/modules/team/entities/team.entity";

@Entity("matches")
export class MatchEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ name: "campain_id", type: "int", unsigned: true })
  campainId!: number;

  @Column({ name: "home_team_id", type: "int", unsigned: true, nullable: true })
  homeTeamId: number;

  @Column({ name: "away_team_id", type: "int", unsigned: true, nullable: true })
  awayTeamId: number;

  @Column({ name: "current_minute", type: "int", unsigned: true, default: 0 })
  currentMinute: number;

  @Column({ name: "clock_seconds", type: "int", unsigned: true, default: 0 })
  clockSeconds: number;

  @Column({
    type: "enum",
    enum: EMatchStatus,
    default: EMatchStatus.IN_PROGRESS,
  })
  status: EMatchStatus;

  @Column({ name: "home_score", type: "int", nullable: true })
  homeScore: number | null;

  @Column({ name: "away_score", type: "int", nullable: true })
  awayScore: number | null;

  @CreateDateColumn({ name: "started_at", type: "timestamp" })
  startedAt: Date;

  @Column({ name: "ended_at", type: "timestamp", nullable: true })
  endedAt: Date | null;

  @Column({ name: "home_lineup", type: "json", nullable: true })
  homeLineup: Record<string, unknown>[] | null;

  @Column({ name: "away_lineup", type: "json", nullable: true })
  awayLineup: Record<string, unknown>[] | null;

  @Column({ name: "latest_snapshot", type: "json", nullable: true })
  latestSnapshot: Record<string, unknown> | null;

  @Column({ name: "timeline", type: "json", nullable: true })
  timeline: Record<string, unknown>[] | null;

  @OneToOne(() => CampainMatchEntity, (campainMatch) => campainMatch.match)
  @JoinColumn({ name: "campain_id" })
  campainMatch: CampainMatchEntity;

  @OneToOne(() => TeamEntity, { nullable: true })
  @JoinColumn({ name: "home_team_id" })
  homeTeam: TeamEntity | null;

  @OneToOne(() => TeamEntity, { nullable: true })
  @JoinColumn({ name: "away_team_id" })
  awayTeam: TeamEntity | null;

  @OneToMany(() => MatchEventEntity, (matchEvent) => matchEvent.match)
  matchEvents: MatchEventEntity[];

  @OneToMany(() => MatchPlayerStatsEntity, (matchPlayerStats) => matchPlayerStats.match)
  matchPlayerStats: MatchPlayerStatsEntity[];
}
