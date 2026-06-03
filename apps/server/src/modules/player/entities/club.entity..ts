import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { LeagueEntity } from "./league.entity";

@Entity("clubs")
export class ClubEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ type: "varchar", length: 191 })
  name: string;

  @Column({ type: "varchar", length: 512 })
  img_url: string;

  @Column({ name: "league_id", type: "bigint", unsigned: true })
  leagueId: bigint;

  @ManyToOne(() => LeagueEntity, (league) => league.clubs, { nullable: true })
  @JoinColumn({ name: "league_id" })
  league: LeagueEntity;
}