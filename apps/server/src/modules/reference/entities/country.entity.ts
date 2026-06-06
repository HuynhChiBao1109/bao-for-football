import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { LeagueEntity } from "./league.entity";
import { PlayerEntity } from "../../player/entities/player-admin.entity";

@Entity("countries")
export class CountryEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ type: "varchar", length: 191 })
  name: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  img_url: string | null;

  @OneToMany(() => LeagueEntity, (league) => league.country)
  leagues?: LeagueEntity[];

  @OneToMany(() => PlayerEntity, (player) => player.country)
  players: PlayerEntity[];
}
