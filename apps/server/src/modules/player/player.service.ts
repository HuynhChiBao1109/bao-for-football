import { BadRequestException, Injectable } from "@nestjs/common";
import { IPlayerService } from "./interfaces/player-service.interface";
import { PlayerRepository } from "./player.repository";
import { AuthUser } from "../auth/types";
import { getPlayerSkillSlug } from "./enum/player-skill.enum";
import { PlayerEntity } from "./entities/player-admin.entity";
import { UserPlayerEntity } from "./entities/player-user.entity";

export type UserPlayerCardResponse = {
  userPlayerId: number;
  templateId: number;
  name: string;
  season?: string;
  level: number;
  currentExp: number;
  currentPoints: number;
  baseStats: Record<string, number>;
  bonusStats: Record<string, number>;
  totalStats: Record<string, number>;
  positions: Array<{ position: string; effect: number }>;
  skills: Array<{ id: number; name: string; buffType?: string; buffValue?: number }>;
};

@Injectable()
export class PlayerService implements IPlayerService {
  constructor(private readonly repository: PlayerRepository) {}

  async getMyPlayers(user: AuthUser): Promise<UserPlayerCardResponse[]> {
    const userPlayers = await this.repository.getUserPlayersByUserId(Number(user.id));
    const playerIds = userPlayers.map((item) => item.playerId);
    const userPlayerIds = userPlayers.map((item) => item.id);
    const [players, skills] = await Promise.all([
      this.repository.getPlayersByIds(playerIds),
      this.repository.getUserPlayerSkills(userPlayerIds),
    ]);

    const playerMap = new Map(players.map((item) => [String(item.id), item]));
    const skillMap = new Map<string, typeof skills>(userPlayerIds.map((id) => [String(id), []]));
    skills.forEach((skill) => {
      const key = String(skill.userPlayerId);
      const current = skillMap.get(key) ?? [];
      current.push(skill);
      skillMap.set(key, current);
    });

    return userPlayers
      .map((item) => {
        const player = playerMap.get(String(item.playerId));
        if (!player) return null;
        return this.toUserPlayerCard(item, player, skillMap.get(String(item.id)) ?? []);
      })
      .filter((item): item is UserPlayerCardResponse => Boolean(item));
  }

  async insertPlayerToUserByClubId(user: AuthUser, clubId: number): Promise<void> {
    const listPlayerByClub = await this.repository.getListPlayerByClubId(clubId);

    if (listPlayerByClub.length === 0) {
      throw new BadRequestException("No players found for the specified club");
    }

    // insert all player to user
    // Assuming you have a method in your repository to handle the insertion
    for (const player of listPlayerByClub) {
      await this.repository.createPlayerUser(user.id, player.id);
    }
  }

  private toUserPlayerCard(
    userPlayer: UserPlayerEntity,
    player: PlayerEntity,
    skills: Array<{ skill: number }>,
  ): UserPlayerCardResponse {
    const baseStats = {
      shooting: player.shoot,
      passing: player.pass,
      longPass: player.longPass,
      vision: player.vision,
      attackingAwareness: Math.round((player.shoot + player.vision) / 2),
      defensiveAwareness: player.tackle,
      duels: Math.round((player.tackle + player.balance) / 2),
      pace: player.speed,
      stamina: player.stamina,
      balance: player.balance,
      technique: Math.round((player.dribbling + player.vision) / 2),
      determination: Math.round((player.stamina + player.balance) / 2),
      strength: player.balance,
      standingTackle: player.tackle,
      slidingTackle: player.tackle,
      dribbling: player.dribbling,
      curve: Math.round((player.shoot + player.longPass) / 2),
      gkParrying: player.gkKeeping,
      gkReflex: player.gkReflex,
      gkReach: player.gkReach,
    };
    const bonusStats = {
      shooting: userPlayer.bonusAttack,
      passing: userPlayer.bonusPass,
      longPass: userPlayer.bonusPass,
      vision: userPlayer.bonusPass,
      attackingAwareness: userPlayer.bonusAttack,
      defensiveAwareness: userPlayer.bonusDefense,
      duels: userPlayer.bonusDefense,
      pace: userPlayer.bonusAgility,
      stamina: userPlayer.bonusDefense,
      balance: userPlayer.bonusAgility,
      technique: userPlayer.bonusAgility,
      determination: userPlayer.bonusDefense,
      strength: userPlayer.bonusDefense,
      standingTackle: userPlayer.bonusDefense,
      slidingTackle: userPlayer.bonusDefense,
      dribbling: userPlayer.bonusAgility,
      curve: userPlayer.bonusAttack,
      gkParrying: userPlayer.bonusGoalkeeping,
      gkReflex: userPlayer.bonusGoalkeeping,
      gkReach: userPlayer.bonusGoalkeeping,
    };
    const totalStats = Object.fromEntries(
      Object.entries(baseStats).map(([key, value]) => [
        key,
        Number(value) + Number(bonusStats[key as keyof typeof bonusStats] ?? 0),
      ]),
    );

    return {
      userPlayerId: userPlayer.id,
      templateId: player.id,
      name: player.name,
      season: player.season,
      level: 1 + Math.floor(Number(userPlayer.exp ?? 0) / 100),
      currentExp: Number(userPlayer.exp ?? 0),
      currentPoints: 0,
      baseStats,
      bonusStats,
      totalStats,
      positions: (userPlayer.positions ?? player.positions ?? []).map((position) => ({
        position: String(position.position),
        effect: Number(position.rating ?? 1),
      })),
      skills: skills.map((skill) => ({
        id: Number(skill.skill),
        name: getPlayerSkillSlug(skill.skill as never) ?? `skill-${skill.skill}`,
      })),
    };
  }
}
