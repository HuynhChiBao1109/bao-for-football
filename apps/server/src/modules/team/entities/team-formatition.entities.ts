import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { ETeamFormation } from "../types/team-formation.enum";
import { ETeamType } from "../types/team-type.enum";
import { UserEntity } from "src/modules/user/user.entities";
import { UserPlayerEntity } from "src/modules/player/entities/player.entities";
import { TeamEntity } from "./team.entities";
import { AbstractEntity } from "src/database/database.abjact";

@Entity("user_team_formations")
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
