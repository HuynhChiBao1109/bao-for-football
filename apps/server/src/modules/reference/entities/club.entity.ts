import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { LeagueEntity } from "./league.entity";

@Entity("clubs")
export class ClubEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ type: "varchar", length: 191 })
  name: string;

  @Column({ name: "img_url", type: "varchar", length: 512 })
  imgUrl: string;

  @Column({ name: "league_id", type: "int", unsigned: true })
  leagueId: number;

  @ManyToOne(() => LeagueEntity, (league) => league.clubs, { nullable: true })
  @JoinColumn({ name: "league_id" })
  league: LeagueEntity;
}
