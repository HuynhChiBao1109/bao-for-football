import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { AbstractEntity } from "src/database/database.abjact";
import { ECampainType } from "src/modules/enum/campain-type.enum";
import { TeamEntity } from "src/modules/team/entities/team.entity";
import { CampainMatchEntity } from "./campain-match.entity";

@Entity("campains")
export class CampainEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({
    name: "type",
    type: "enum",
    enum: ECampainType,
    default: ECampainType.NORMAL,
  })
  type: ECampainType;

  @Column({ name: "level", type: "int" })
  level: number;

  @Column({ name: "team_id", type: "bigint", unsigned: true })
  teamId: bigint;

  @ManyToOne(() => TeamEntity, (team) => team.campains, { onDelete: "CASCADE" })
  @JoinColumn({ name: "team_id" })
  team: TeamEntity;

  @OneToMany(() => CampainMatchEntity, (match) => match.campain)
  campainMatches: CampainMatchEntity[];
}
