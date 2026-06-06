import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { AbstractEntity } from "src/database/database.abjact";
import { CampainEntity } from "./campain.entity";
import { ClubEntity } from "src/modules/reference/entities/club.entity";
import { MatchEntity } from "src/modules/match/entities/match.entity";
import { TeamEntity } from "src/modules/team/entities/team.entity";

@Entity("campain_matches")
export class CampainMatchEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({
    name: "campain_id",
    type: "bigint",
    unsigned: true,
  })
  campainId: bigint;

  @Column({ name: "level", type: "int" })
  level: number;

  @Column({ name: "competitor_id", type: "bigint", unsigned: true })
  competitorId: bigint;

  @Column({ name: "reward", type: "bigint", unsigned: true })
  matchReward: bigint;

  @ManyToOne(() => CampainEntity, (campain) => campain.campainMatches, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "campain_id" })
  campain: CampainEntity;

  @ManyToOne(() => TeamEntity, (team) => team.campainMatches, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "competitor_id" })
  competitor: TeamEntity;

  @OneToOne(() => MatchEntity, (match) => match.campainMatch)
  match: MatchEntity;
}
