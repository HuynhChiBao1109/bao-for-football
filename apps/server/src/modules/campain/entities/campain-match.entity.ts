import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { AbstractEntity } from "src/database/database.abjact";
import { CampainEntity } from "./campain.entity";
import { ClubEntity } from "src/modules/reference/entities/club.entity";
import { MatchEntity } from "src/modules/match/entities/match.entity";
import { TeamEntity } from "src/modules/team/entities/team.entity";

@Entity("campain_matches")
export class CampainMatchEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({
    name: "campain_id",
    type: "int",
    unsigned: true,
  })
  campainId: number;

  @Column({ name: "level", type: "int" })
  level: number;

  @Column({ name: "competitor_id", type: "int", unsigned: true })
  competitorId: number;

  @Column({ name: "reward", type: "int", unsigned: true })
  matchReward: number;

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
