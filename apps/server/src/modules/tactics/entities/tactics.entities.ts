import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("team_tactics")
@Unique(["teamId"])
export class TeamTacticsEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "team_id", type: "varchar", length: 32 })
  teamId!: string;

  @Column({ type: "varchar", length: 10 })
  formation!: string;

  @Column({ name: "pass_ratio", type: "double" })
  passRatio!: number;

  @Column({ name: "shot_ratio", type: "double" })
  shotRatio!: number;

  @Column({ type: "double" })
  pressure!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}

@Entity("team_lineups")
@Unique(["teamId", "slotId"])
export class TeamLineupEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "team_id", type: "varchar", length: 32 })
  teamId!: string;

  @Column({ name: "slot_id", type: "varchar", length: 32 })
  slotId!: string;

  @Column({ type: "varchar", length: 10 })
  position!: string;

  @Column({ name: "user_player_id", type: "bigint", unsigned: true })
  userPlayerId!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "timestamp",
    default: () => "CURRENT_TIMESTAMP",
  })
  updatedAt!: Date;
}
