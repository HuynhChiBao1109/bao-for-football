import { UserEntity } from "src/modules/auth/entities/auth.entities";
import {
  Column,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { ETeamFormation } from "../types/team-formation.enum";

@Entity("teams")
@Unique(["userId"])
export class TeamEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: bigint;

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

  @Column({ type: "double" })
  pressure!: number;

  @OneToOne(() => UserEntity, (user) => user.id, { onDelete: "CASCADE" })
  user: UserEntity;
}
