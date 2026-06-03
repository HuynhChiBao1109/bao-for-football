import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { AbstractEntity } from "src/database/database.abjact";
import { TeamEntity } from "src/modules/team/entities/team.entity";
import { CampainEntity } from "./campain.entity";
import { ClubEntity } from "src/modules/player/entities/club.entity.";

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

  @Column({ name: "competitor_club_id", type: "bigint", unsigned: true })
  competitorClubId: bigint;

  @Column({ name: "reward", type: "bigint", unsigned: true })
  matchReward: bigint;

  @ManyToOne(() => CampainEntity, (campain) => campain.campainMatches, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "campain_id" })
  campain: CampainEntity;

  @ManyToOne(() => ClubEntity, (club) => club.campainMatches, { onDelete: "CASCADE" })
  @JoinColumn({ name: "competitor_club_id" })
  competitorClub: ClubEntity;
}
