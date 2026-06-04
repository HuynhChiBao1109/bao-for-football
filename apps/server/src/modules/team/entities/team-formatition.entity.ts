import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { UserPlayerEntity } from "src/modules/player/entities/player-user.entity";
import { TeamEntity } from "./team.entity";
import { AbstractEntity } from "src/database/database.abjact";

@Entity("team_formations")
export class TeamFormationEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "team_id", type: "bigint", unsigned: true })
  teamId: bigint;

  @Column({ name: "user_player_id", type: "bigint", unsigned: true })
  userPlayerId!: bigint;

  @Column({
    name: "position",
    type: "json",
  })
  position: any;

  @OneToOne(() => UserPlayerEntity, (userPlayer) => userPlayer.id, {
    onDelete: "CASCADE",
  })
  userPlayer: UserPlayerEntity;

  @ManyToOne(() => TeamEntity, (team) => team.id, { onDelete: "CASCADE" })
  team: TeamEntity;
}
