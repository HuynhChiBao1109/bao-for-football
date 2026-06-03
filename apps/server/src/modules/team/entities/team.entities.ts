import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ETeamFormation } from "../types/team-formation.enum";
import { ETeamType } from "../types/team-type.enum";

@Entity("teams")
export class TeamEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ type: "varchar", length: 191, unique: true })
  userName: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ name: "club_name", type: "varchar", length: 191 })
  clubName!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  image!: string;

  @Column({ type: "bigint", default: 360000000 })
  budget: bigint;

  @Column({ name: "rank_point", type: "int", default: 0 })
  rankPoint: number;

  @Column({ type: "enum", enum: ETeamFormation })
  formation: ETeamFormation;

  @Column({ name: "pass_ratio", type: "double" })
  passRatio!: number;

  @Column({ name: "shot_ratio", type: "double" })
  shotRatio!: number;

  @Column({ type: "int", default: 50, unsigned: true })
  pressure: number;

  @Column({ type: "enum", enum: ETeamType })
  type!: ETeamType;
}
