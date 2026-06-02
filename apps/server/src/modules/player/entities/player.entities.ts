import { AbstractEntity } from "src/database/database.abjact";
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { EPlayerSkill } from "../types/player-skill.enum";
import { TeamEntity } from "src/modules/team/entities/team.entities";

@Entity("team_players")
export class TeamPlayerEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "team_id", type: "bigint", unsigned: true })
  teamId: bigint;

  @Column({ name: "player_id", type: "bigint", unsigned: true })
  playerId: bigint;

  @Column({ type: "int", default: 0 })
  exp!: number;

  @Column({ name: "bonus_attack", type: "int", default: 0 })
  bonusAttack!: number;

  @Column({ name: "bonus_defense", type: "int", default: 0 })
  bonusDefense!: number;

  @Column({ name: "bonus_agility", type: "int", default: 0 })
  bonusAgility!: number;

  @Column({ name: "bonus_pass", type: "int", default: 0 })
  bonusPass!: number;

  @Column({ name: "bonus_goalkeeping", type: "int", default: 0 })
  bonusGoalkeeping!: number;
  
  @ManyToOne(() => TeamPlayerSkillEntity, (skill) => skill.teamPlayerId)
  skills: TeamPlayerSkillEntity[];

  @ManyToOne(() => TeamEntity, (player) => player.id, { onDelete: "CASCADE" })
  team: TeamEntity;
}

@Entity("team_player_skills")
@Unique(["teamPlayerId", "skill"])
export class TeamPlayerSkillEntity extends AbstractEntity {
  @PrimaryGeneratedColumn({ type: "bigint", unsigned: true })
  id: bigint;

  @Column({ name: "team_player_id", type: "bigint", unsigned: true })
  teamPlayerId: bigint;

  @Column({ name: "skill", type: "enum", enum: EPlayerSkill })
  skill: EPlayerSkill;
  
  @ManyToOne(() => TeamPlayerEntity, (player) => player.skills, { onDelete: "CASCADE" })
  teamPlayer: TeamPlayerEntity;
}
