import { AbstractEntity } from "src/database/database.abjact";
import { TeamEntity } from "src/modules/team/entities/team.entities";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  PrimaryGeneratedColumn,
  Unique,
  OneToOne,
} from "typeorm";

@Entity("users")
export class UserEntity extends AbstractEntity{
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ type: "varchar", length: 191, unique: true })
  userName!: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash!: string;

  @OneToOne(() => TeamEntity, (team) => team.user)
  team: TeamEntity;
}