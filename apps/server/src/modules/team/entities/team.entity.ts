import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ETeamFormation } from "../enums/team-formation.enum";
import { ETeamType } from "../enums/team-type.enum";
import { UserEntity } from "src/modules/user/entities/user.entity";
import { TeamFormationEntity } from "./team-formatition.entity";
import { AbstractEntity } from "src/database/database.abjact";
import { CampainEntity } from "src/modules/campain/entities/campain.entity";
import { CampainMatchEntity } from "src/modules/campain/entities/campain-match.entity";
import type { TeamMentality, TeamPlayStyle } from "../team-tactics";

@Entity("teams")
export class TeamEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "int", unsigned: true })
  id: number;

  @Column({ name: "user_id", type: "int", unsigned: true, nullable: true })
  userId!: number;

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

  @Column({ name: "mentality", type: "varchar", length: 32, default: "balanced" })
  mentality: TeamMentality;

  @Column({ name: "defensive_width", type: "tinyint", unsigned: true, default: 5 })
  defensiveWidth: number;

  @Column({ name: "defensive_depth", type: "tinyint", unsigned: true, default: 5 })
  defensiveDepth: number;

  @Column({ name: "build_up_play", type: "varchar", length: 32, default: "balanced" })
  buildUpPlay: TeamPlayStyle;

  @Column({ name: "chance_creation", type: "varchar", length: 32, default: "balanced" })
  chanceCreation: TeamPlayStyle;

  @Column({ name: "attacking_width", type: "tinyint", unsigned: true, default: 5 })
  attackingWidth: number;

  @Column({ name: "players_in_box", type: "tinyint", unsigned: true, default: 5 })
  playersInBox: number;

  @Column({ name: "corners", type: "tinyint", unsigned: true, default: 3 })
  corners: number;

  @Column({ name: "free_kicks", type: "tinyint", unsigned: true, default: 3 })
  freeKicks: number;

  @Column({ name: "rank_point", type: "int", default: 0 })
  rankPoint: number;

  @Column({ type: "int", default: 360000000 })
  budget: number;

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

  @OneToMany(() => CampainMatchEntity, (campainMatch) => campainMatch.competitor)
  campainMatches: CampainMatchEntity[];
}
