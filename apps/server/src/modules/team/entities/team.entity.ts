import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ETeamFormation } from "../enums/team-formation.enum";
import { ETeamType } from "../enums/team-type.enum";
import { UserEntity } from "src/modules/user/entities/user.entity";
import { TeamFormationEntity } from "./team-formatition.entity";
import { AbstractEntity } from "src/database/database.abjact";
import { CampainEntity } from "src/modules/campain/entities/campain.entity";

@Entity("teams")
export class TeamEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "user_id", type: "bigint", unsigned: true, nullable: true })
  userId!: bigint;

  @Column({ name: "team_name", type: "varchar", length: 191 })
  teamName!: string;

  @Column({ name: "img_url", type: "varchar", length: 512, nullable: true })
  imgUrl!: string;

  @Column({ name: "formation", type: "enum", enum: ETeamFormation })
  formation: ETeamFormation;

  @Column({ name: "pass_ratio", type: "double", default: 0 })
  passRatio: number;

  @Column({ name: "shot_ratio", type: "double", default: 0 })
  shotRatio: number;

  @Column({ name: "pressure", type: "int", default: 50, unsigned: true })
  pressure: number;

  @Column({ name: "rank_point", type: "int", default: 0 })
  rankPoint: number;

  @Column({ type: "bigint", default: 360000000 })
  budget: bigint;

  @Column({
    name: "type",
    type: "enum",
    enum: ETeamType,
    default: ETeamType.BOT,
  })
  type!: ETeamType;

  @ManyToOne(() => UserEntity, (user) => user.teams, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: UserEntity;

  @OneToMany(() => TeamFormationEntity, (formation) => formation.team)
  teamFormations: TeamFormationEntity[];

  @OneToMany(() => CampainEntity, (campain) => campain.team)
  campains: CampainEntity[];
}
