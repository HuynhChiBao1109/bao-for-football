import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { MatchEntity } from "./match.entity";

@Entity("match_player_stats")
export class MatchPlayerStatsEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "match_id", type: "bigint", unsigned: true })
  matchId: bigint;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: bigint;

  @Column({ name: "goals", type: "int", unsigned: true, default: 0 })
  goals: number;
  @Column({ name: "assists", type: "int", unsigned: true, default: 0 })
  assists: number;

  @Column({ name: "yellow_cards", type: "int", unsigned: true, default: 0 })
  yellowCards: number;
  @Column({ name: "red_cards", type: "int", unsigned: true, default: 0 })
  redCards: number;

  @Column({ name: "passes", type: "int", unsigned: true, default: 0 })
  passes: number;

  @Column({ name: "pass_accuracy", type: "int", unsigned: true, default: 0 })
  passAccuracy: number;

  @Column({ name: "tackles", type: "int", unsigned: true, default: 0 })
  tackles: number;
  @Column({ name: "tackle_accuracy", type: "int", unsigned: true, default: 0 })
  tackleAccuracy: number;

  @Column({ name: "interceptions", type: "int", unsigned: true, default: 0 })
  interceptions: number;

  @Column({ name: "minutes_played", type: "int", unsigned: true, default: 0 })
  minutesPlayed: number;

  @Column({ name: "shots", type: "int", unsigned: true, default: 0 })
  shots: number;
  @Column({ name: "shot_accuracy", type: "int", unsigned: true, default: 0 })
  shotAccuracy: number;

  @Column({ name: "dribbles", type: "int", unsigned: true, default: 0 })
  dribbles: number;
  @Column({ name: "dribble_accuracy", type: "int", unsigned: true, default: 0 })
  dribbleAccuracy: number;

  @Column({ name: "fouls_committed", type: "int", unsigned: true, default: 0 })
  foulsCommitted: number;
  @Column({ name: "fouls_suffered", type: "int", unsigned: true, default: 0 })
  foulsSuffered: number;

  @Column({ name: "offsides", type: "int", unsigned: true, default: 0 })
  offsides: number;

  @Column({ name: "rating", type: "float", unsigned: true, default: 5 })
  rating: number;

  @ManyToOne(() => MatchEntity, (match) => match.matchPlayerStats, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "match_id" })
  match: MatchEntity;
}
