import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { MatchEntity } from "./match.entity";
import { EMatchEvent } from "../enums";

@Entity("match_events")
export class MatchEventEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "match_id", type: "bigint", unsigned: true })
  matchId: bigint;

  @Column({ name: "event_type", type: "enum", enum: EMatchEvent, length: 255 })
  event: EMatchEvent;

  @Column({ name: "minute", type: "int", unsigned: true })
  minute: number;

  @ManyToOne(() => MatchEntity, (match) => match.matchEvents, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "match_id" })
  match: MatchEntity;
}
