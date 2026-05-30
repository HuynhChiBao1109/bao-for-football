import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { LeagueEntity } from "../../player/entities/player-admin.entities";

@Entity("clubs")
export class ClubEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ type: "varchar", length: 191 })
  name!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  logo!: string | null;

  @Column({
    name: "country_id",
    type: "bigint",
    unsigned: true,
    nullable: true,
  })
  countryId!: string | null;

  @Column({ name: "league_id", type: "bigint", unsigned: true, nullable: true })
  leagueId!: string | null;

  @ManyToOne(() => LeagueEntity, { nullable: true })
  @JoinColumn({ name: "league_id" })
  league?: LeagueEntity | null;
}
