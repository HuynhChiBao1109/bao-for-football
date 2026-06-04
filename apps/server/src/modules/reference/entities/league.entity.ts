import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CountryEntity } from "./country.entity";
import { ClubEntity } from "./club.entity";

@Entity("leagues")
export class LeagueEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ type: "varchar", length: 191 })
  name: string;

  @Column({
    name: "country_id",
    type: "bigint",
    unsigned: true,
  })
  countryId: bigint | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  img_url: string | null;

  @ManyToOne(() => CountryEntity, (country) => country.leagues, {
    nullable: true,
  })
  @JoinColumn({ name: "country_id" })
  country: CountryEntity | null;

  @OneToMany(() => ClubEntity, (club) => club.league)
  clubs: ClubEntity[];
}
