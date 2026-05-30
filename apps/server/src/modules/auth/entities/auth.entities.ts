import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ type: "varchar", length: 191, unique: true })
  username!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt!: Date;
}

@Entity("teams")
@Unique(["userId"])
export class TeamEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id!: string;

  @Column({ name: "user_id", type: "bigint", unsigned: true })
  userId!: string;

  @Column({ name: "club_name", type: "varchar", length: 191 })
  clubName!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  image!: string | null;

  @Column({ type: "bigint", default: 360000000 })
  budget!: string;

  @Column({ name: "rank_point", type: "int", default: 0 })
  rankPoint!: number;
}
