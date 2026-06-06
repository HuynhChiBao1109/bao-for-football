import { AbstractEntity } from "src/database/database.abjact";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { MatchEntity } from "./match.entity";
import { EMatchEvent } from "../enums";

@Entity("match_events")
export class MatchEventEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "match_id", type: "bigint", unsigned: true })
  matchId: bigint;

  @Column({ name: "event", type: "enum", enum: EMatchEvent })
  event: EMatchEvent;

  @Column({ name: "minute", type: "int", unsigned: true })
  minute: number;

  @Column({ name: "team_id", type: "bigint", unsigned: true, nullable: true })
  teamId: bigint | null;

  @Column({ name: "actor_player_id", type: "bigint", unsigned: true, nullable: true })
  actorPlayerId: bigint | null;

  @Column({ name: "secondary_player_id", type: "bigint", unsigned: true, nullable: true })
  secondaryPlayerId: bigint | null;

  @Column({ name: "payload", type: "json", nullable: true })
  payload: Record<string, unknown> | null;

  @ManyToOne(() => MatchEntity, (match) => match.matchEvents, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "match_id" })
  match: MatchEntity;
}
