import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IMatchService } from "./interfaces/match-service.interface";
import { MatchRepository } from "./match.repository";
import { MatchEntity } from "./entities/match.entity";
import { AuthUser } from "../auth/types";
import { EMatchStatus } from "./enums";
import {
  generateNextMatchTick,
  MatchSnapshot,
  prepareMatchKickoffLineups,
  SimulationRosterPlayer,
  SimulationTeamInput,
} from "./match-simulation.util";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { ESocketChannel, ESocketEvent } from "../socket/enums";
import { SocketService } from "../socket/socket.service";
import { ETeamFormation } from "../team/enums/team-formation.enum";
import { EMatchEvent } from "./enums";

type MatchStartPayload = {
  matchId: string;
  homeLineup: unknown[];
  awayLineup: unknown[];
};

@Injectable()
export class MatchService implements IMatchService {
  constructor(
    private readonly repository: MatchRepository,
    private readonly socketService: SocketService,
  ) {}

  async startCampaignMatch(user: AuthUser, campaignMatchId: number): Promise<MatchStartPayload> {
    if (!campaignMatchId) {
      throw new BadRequestException("campainMatchId is required");
    }

    const campaignMatch = await this.repository.findCampaignMatchById(campaignMatchId);
    if (!campaignMatch) {
      throw new NotFoundException("Campaign match not found");
    }

    const homeTeam = campaignMatch.campain?.team;
    const awayTeam = campaignMatch.competitor;

    if (!homeTeam || !awayTeam) {
      throw new BadRequestException("Campaign match is missing team data");
    }

    if (String(homeTeam.userId || "") !== String(user.id)) {
      throw new BadRequestException("You do not own this campaign match");
    }

    const campaignLevel = Number(campaignMatch.campain?.level ?? 1);
    if (Number(campaignMatch.level) > campaignLevel) {
      throw new BadRequestException("Campaign match level is not unlocked yet");
    }

    const existingMatch = await this.repository.findMatchByCampaignMatchId(campaignMatchId);
    if (existingMatch) {
      const existingHomeScore = Number(existingMatch.homeScore ?? 0);
      const existingAwayScore = Number(existingMatch.awayScore ?? 0);
      const existingHomeWon = existingMatch.status === EMatchStatus.FINISHED && existingHomeScore > existingAwayScore;
      const alreadyCleared = Number(campaignMatch.level) < campaignLevel;

      if (existingMatch.status === EMatchStatus.IN_PROGRESS) {
        return {
          matchId: String(existingMatch.id),
          homeLineup: existingMatch.homeLineup ?? [],
          awayLineup: existingMatch.awayLineup ?? [],
        };
      }

      if (existingHomeWon || alreadyCleared) {
        return {
          matchId: String(existingMatch.id),
          homeLineup: existingMatch.homeLineup ?? [],
          awayLineup: existingMatch.awayLineup ?? [],
        };
      }

      await this.repository.deleteById(existingMatch.id);
    }

    const [homePlayers, awayPlayers] = await Promise.all([
      this.buildTeamRoster(homeTeam.id, homeTeam.userId, homeTeam.teamName),
      this.buildTeamRoster(awayTeam.id, awayTeam.userId, awayTeam.teamName),
    ]);

    if (homePlayers.length < 11 || awayPlayers.length < 11) {
      throw new BadRequestException("One of the teams does not have enough players to start");
    }

    const lineups = prepareMatchKickoffLineups(
      {
        id: homeTeam.id,
        name: homeTeam.teamName,
        formation: homeTeam.formation ?? ETeamFormation.F433,
        passRatio: Number(homeTeam.passRatio ?? 50),
        shotRatio: Number(homeTeam.shotRatio ?? 50),
        pressure: Number(homeTeam.pressure ?? 50),
        players: homePlayers,
      },
      {
        id: awayTeam.id,
        name: awayTeam.teamName,
        formation: awayTeam.formation ?? ETeamFormation.F433,
        passRatio: Number(awayTeam.passRatio ?? 50),
        shotRatio: Number(awayTeam.shotRatio ?? 50),
        pressure: Number(awayTeam.pressure ?? 50),
        players: awayPlayers,
      },
    );

    const match = await this.repository.create({
      campainId: campaignMatch.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      status: EMatchStatus.IN_PROGRESS,
      currentMinute: 0,
      clockSeconds: 0,
      homeScore: 0,
      awayScore: 0,
      homeLineup: lineups.homeLineup,
      awayLineup: lineups.awayLineup,
      latestSnapshot: null,
      timeline: [],
    });

    return {
      matchId: String(match.id),
      homeLineup: lineups.homeLineup,
      awayLineup: lineups.awayLineup,
    };
  }

  async getById(matchId: number): Promise<MatchEntity> {
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }

    return match;
  }

  async getNextTick(matchId: number) {
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }

    if (match.status !== EMatchStatus.IN_PROGRESS) {
      throw new BadRequestException("Match is not in progress");
    }

    const previousTicks = ((match.timeline ?? []) as MatchSnapshot[]).filter(Boolean);
    const nextTick = generateNextMatchTick({
      previousTicks,
      homeLineup: (match.homeLineup ?? []) as any,
      awayLineup: (match.awayLineup ?? []) as any,
      homeTeamId: match.homeTeamId ?? null,
    });

    if (!nextTick) {
      throw new BadRequestException("No more debug ticks to generate");
    }

    const timeline = [...previousTicks, nextTick.snapshot];

    const isFinished = nextTick.snapshot.highlight?.event === EMatchEvent.MATCH_END;

    await this.repository.update(match.id, {
      currentMinute: nextTick.snapshot.minute,
      clockSeconds: nextTick.snapshot.second,
      latestSnapshot: nextTick.snapshot,
      timeline,
      homeScore: nextTick.snapshot.homeScore,
      awayScore: nextTick.snapshot.awayScore,
      status: isFinished ? EMatchStatus.FINISHED : EMatchStatus.IN_PROGRESS,
      endedAt: isFinished ? new Date() : null,
    });

    await this.repository.saveEvents([
      {
        matchId: match.id,
        event: nextTick.event.event,
        minute: nextTick.event.minute,
        teamId: nextTick.event.teamId,
        actorPlayerId: nextTick.event.actorPlayerId,
        secondaryPlayerId: nextTick.event.secondaryPlayerId,
        payload: nextTick.event.payload,
      },
    ]);

    this.emitSnapshot(match, nextTick.snapshot);

    if (isFinished) {
      this.socketService.emitToRoom({
        roomId: `${ESocketChannel.MATCH}${String(match.id)}`,
        event: ESocketEvent.MATCH_COMPLETED,
        data: {
          matchId: String(match.id),
          homeScore: nextTick.snapshot.homeScore,
          awayScore: nextTick.snapshot.awayScore,
        },
      });
    }

    return {
      matchId: String(match.id),
      frameId: nextTick.snapshot.frameId,
      tick: nextTick.snapshot.tick,
      snapshot: nextTick.snapshot,
    };
  }

  async finalize(matchId: number, payload: Partial<MatchEntity>): Promise<MatchEntity> {
    await this.repository.update(matchId, payload);
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }
    return match;
  }

  private emitSnapshot(match: MatchEntity, snapshot: MatchSnapshot) {
    const matchId = String(match.id);
    const roomId = `${ESocketChannel.MATCH}${matchId}`;

    this.socketService.emitToRoom({
      roomId,
      event: ESocketEvent.MATCH_SNAPSHOT,
      data: {
        matchId,
        frameId: snapshot.frameId,
        tick: snapshot.tick,
        minute: snapshot.minute,
        snapshot,
      },
    });

    if (snapshot.highlight?.event || snapshot.highlight?.skill) {
      this.socketService.emitToRoom({
        roomId,
        event: ESocketEvent.MATCH_EVENT,
        data: {
          matchId,
          frameId: snapshot.frameId,
          tick: snapshot.tick,
          minute: snapshot.minute,
          highlight: snapshot.highlight,
        },
      });
    }
  }

  private async buildTeamRoster(
    teamId: number,
    userId: number | null | undefined,
    teamName: string,
  ): Promise<SimulationRosterPlayer[]> {
    if (!userId) {
      return [];
    }

    const [formations, userPlayers] = await Promise.all([
      this.repository.getTeamFormations(teamId),
      this.repository.getUserPlayersByUserId(userId),
    ]);

    const playerIds = userPlayers.map((item) => item.playerId);
    const userPlayerIds = userPlayers.map((item) => item.id);
    const [players, userSkills] = await Promise.all([
      this.repository.getPlayersByIds(playerIds),
      this.repository.getUserPlayerSkills(userPlayerIds),
    ]);

    const playerMap = new Map<string, PlayerEntity>(players.map((item) => [String(item.id), item]));
    const skillMap = new Map<string, UserPlayerSkillEntity[]>(
      userPlayers.map((item) => [String(item.id), []]),
    );
    userSkills.forEach((item) => {
      const key = String(item.userPlayerId);
      const current = skillMap.get(key) ?? [];
      current.push(item);
      skillMap.set(key, current);
    });

    const formationOrder = formations.reduce<Record<string, number>>((acc, item, index) => {
      acc[String(item.userPlayerId)] = index;
      return acc;
    }, {});

    return userPlayers
      .map((item) => {
        const player = playerMap.get(String(item.playerId));
        if (!player) {
          return null;
        }

        const skills = skillMap.get(String(item.id)) ?? [];
        return {
          userPlayerId: item.id,
          playerId: item.playerId,
          teamId,
          name: player.name,
          avatarUrl: player.avatarUrl,
          positions: (item.positions ?? []).map((position) => ({
            position: String(position.position),
            effect: Number(position.rating ?? 1),
          })),
          skills: skills.map((skill) => skill.skill),
          stats: {
            pass: player.pass + item.bonusPass,
            longPass: player.longPass + item.bonusPass,
            vision: player.vision + item.bonusPass,
            shoot: player.shoot + item.bonusAttack,
            tackle: player.tackle + item.bonusDefense,
            balance: player.balance + item.bonusAgility,
            dribbling: player.dribbling + item.bonusAgility,
            acceleration: player.acceleration + item.bonusAgility,
            speed: player.speed + item.bonusAgility,
            stamina: player.stamina + item.bonusDefense,
            gkKeeping: player.gkKeeping + item.bonusGoalkeeping,
            gkReflex: player.gkReflex + item.bonusGoalkeeping,
            gkDiving: player.gkDiving + item.bonusGoalkeeping,
            gkReach: player.gkReach + item.bonusGoalkeeping,
          },
        } satisfies SimulationRosterPlayer;
      })
      .filter((item): item is SimulationRosterPlayer => Boolean(item))
      .sort(
        (left, right) =>
          (formationOrder[String(left.userPlayerId)] ?? Number.MAX_SAFE_INTEGER) -
          (formationOrder[String(right.userPlayerId)] ?? Number.MAX_SAFE_INTEGER),
      );
  }

}
