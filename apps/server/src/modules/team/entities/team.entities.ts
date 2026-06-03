import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ETeamFormation } from "../types/team-formation.enum";
import { ETeamType } from "../types/team-type.enum";
import { UserEntity } from "src/modules/user/user.entities";
import { TeamFormationEntity } from "./team-formatition.entities";
import { AbstractEntity } from "src/database/database.abjact";

@Entity("user_teams")
export class TeamEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId: bigint;

  @Column({ name: "club_name", type: "varchar", length: 191 })
  clubName!: string;

  @Column({ name: "img_url", type: "varchar", length: 512, nullable: true })
  imgUrl!: string;

  @Column({ name: "formation", type: "enum", enum: ETeamFormation })
  formation: ETeamFormation;

  @Column({ name: "pass_ratio", type: "double" })
  passRatio!: number;

  @Column({ name: "shot_ratio", type: "double" })
  shotRatio!: number;

  @Column({ name: "pressure", type: "int", default: 50, unsigned: true })
  pressure: number;

  @Column({ name: "rank_point", type: "int", default: 0 })
  rankPoint: number;

  @Column({ name: "type", type: "enum", enum: ETeamType, default: ETeamType.BOT })
  type!: ETeamType;

  @ManyToOne(() => UserEntity, (user) => user.teams, { onDelete: "CASCADE" })
  user: UserEntity;

  @OneToMany(() => TeamFormationEntity, (formation) => formation.team)
  teamFormations: TeamFormationEntity[];
}
