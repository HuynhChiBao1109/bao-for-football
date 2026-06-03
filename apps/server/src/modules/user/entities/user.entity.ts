import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { TeamEntity } from "../../team/entities/team.entity";
import { UserPlayerEntity } from "src/modules/player/entities/player-user.entity";

@Entity("users")
export class UserEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ type: "varchar", length: 191, unique: true })
  userName: string;

  @Column({ name: "password_hash", type: "varchar", length: 255 })
  passwordHash: string;

  @Column({ name: "salt", type: "varchar", length: 255 })
  salt: string;

  @Column({ name: "is_admin", type: "boolean", default: false })
  isAdmin: boolean;

  @OneToMany(() => TeamEntity, (team) => team.userId)
  teams: TeamEntity[];

  @OneToMany(() => UserPlayerEntity, (userPlayer) => userPlayer.userId)
  userPlayers: UserPlayerEntity[];
}
