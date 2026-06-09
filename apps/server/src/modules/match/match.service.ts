import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IMatchService } from "./interfaces/match-service.interface";
import { MatchRepository } from "./match.repository";
import { MatchEntity } from "./entities/match.entity";
import { AuthUser } from "../auth/types";
import { EMatchStatus } from "./enums";
import {
  FRAME_DURATION_MS,
  MatchSnapshot,
  simulateMatch,
  SimulationRosterPlayer,
  SimulationTeamInput,
} from "./match-simulation.util";
import { PlayerEntity } from "../player/entities/player-admin.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { ESocketChannel, ESocketEvent } from "../socket/enums";
import { SocketService } from "../socket/socket.service";
import { ETeamFormation } from "../team/enums/team-formation.enum";

@Injectable()
export class MatchService implements IMatchService {
  private readonly activeTimers = new Map<string, NodeJS.Timeout>();
  private readonly timelineCache = new Map<string, MatchSnapshot[]>();
  private readonly matchMinuteMs = Number(process.env.MATCH_MINUTE_MS ?? 20_000);

  constructor(
    private readonly repository: MatchRepository,
    private readonly socketService: SocketService,
  ) {}

  async startCampaignMatch(user: AuthUser, campaignMatchId: number): Promise<any> {
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

    const existingMatch = await this.repository.findMatchByCampaignMatchId(campaignMatchId);
    if (existingMatch) {
      this.stopPlayback(String(existingMatch.id));
      this.timelineCache.delete(String(existingMatch.id));
      await this.repository.deleteById(existingMatch.id);
    }

    const [homePlayers, awayPlayers] = await Promise.all([
      this.buildTeamRoster(homeTeam.id, homeTeam.userId, homeTeam.teamName),
      this.buildTeamRoster(awayTeam.id, awayTeam.userId, awayTeam.teamName),
    ]);

    if (homePlayers.length < 11 || awayPlayers.length < 11) {
      throw new BadRequestException("One of the teams does not have enough players to start");
    }

    const simulation = simulateMatch(
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
      campaignMatch.id,
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
      homeLineup: simulation.homeLineup,
      awayLineup: simulation.awayLineup,
      latestSnapshot: simulation.timeline[0] ?? null,
      timeline: null,
    });

    this.timelineCache.set(String(match.id), simulation.timeline);

    await Promise.all([
      this.repository.saveEvents(
        simulation.events.map((event) => ({
          matchId: match.id,
          event: event.event,
          minute: event.minute,
          teamId: event.teamId,
          actorPlayerId: event.actorPlayerId,
          secondaryPlayerId: event.secondaryPlayerId,
          payload: event.payload,
        })),
      ),
      this.repository.savePlayerStats(
        simulation.playerStats.map((stat) => ({
          matchId: match.id,
          playerId: stat.playerId,
          goals: stat.goals,
          assists: stat.assists,
          yellowCards: stat.yellowCards,
          redCards: stat.redCards,
          passes: stat.passes,
          passAccuracy: stat.passAccuracy,
          tackles: stat.tackles,
          tackleAccuracy: stat.tackleAccuracy,
          interceptions: stat.interceptions,
          minutesPlayed: stat.minutesPlayed,
          shots: stat.shots,
          shotAccuracy: stat.shotAccuracy,
          dribbles: stat.dribbles,
          dribbleAccuracy: stat.dribbleAccuracy,
          foulsCommitted: stat.foulsCommitted,
          foulsSuffered: stat.foulsSuffered,
          offsides: stat.offsides,
          rating: stat.rating,
        })),
      ),
    ]);

    this.startPlayback(match, simulation.timeline);

    return {
      matchId: String(match.id),
      status: match.status,
      latestSnapshot: match.latestSnapshot,
    };
  }

  async getById(matchId: number): Promise<MatchEntity> {
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }

    if (match.status === EMatchStatus.IN_PROGRESS) {
      this.ensurePlayback(match);
    }

    return match;
  }

  async finalize(matchId: number, payload: Partial<MatchEntity>): Promise<MatchEntity> {
    await this.repository.update(matchId, payload);
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }
    return match;
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

  private ensurePlayback(match: MatchEntity) {
    const matchId = String(match.id);
    if (this.activeTimers.has(matchId)) {
      return;
    }

    const timeline = this.timelineCache.get(matchId) ?? (match.timeline as MatchSnapshot[] | null);
    if (!timeline?.length) {
      return;
    }

    this.startPlayback(match, timeline);
  }

  private startPlayback(match: MatchEntity, timeline: MatchSnapshot[]) {
    const matchId = String(match.id);
    if (!timeline.length || this.activeTimers.has(matchId)) {
      return;
    }

    const roomId = `${ESocketChannel.MATCH}${matchId}`;
    let cursor = 0;
    this.activeTimers.set(matchId, setTimeout(() => undefined, 0));

    const playFrame = async () => {
      const snapshot = timeline[cursor];
      if (!snapshot) {
        this.stopPlayback(matchId);
        return;
      }

      const isFinal = cursor >= timeline.length - 1;
      await this.repository.update(match.id, {
        currentMinute: snapshot.minute,
        clockSeconds: snapshot.second,
        latestSnapshot: snapshot,
        homeScore: snapshot.homeScore,
        awayScore: snapshot.awayScore,
        status: isFinal ? EMatchStatus.FINISHED : EMatchStatus.IN_PROGRESS,
        endedAt: isFinal ? new Date() : null,
      });

      this.socketService.emitToRoom({
        roomId,
        event: ESocketEvent.MATCH_SNAPSHOT,
        data: { matchId, snapshot },
      });

      if (snapshot.highlight?.event || snapshot.highlight?.skill) {
        this.socketService.emitToRoom({
          roomId,
          event: ESocketEvent.MATCH_EVENT,
          data: { matchId, minute: snapshot.minute, highlight: snapshot.highlight },
        });
      }

      if (isFinal) {
        this.socketService.emitToRoom({
          roomId,
          event: ESocketEvent.MATCH_COMPLETED,
          data: {
            matchId,
            homeScore: snapshot.homeScore,
            awayScore: snapshot.awayScore,
          },
        });
        this.stopPlayback(matchId);
        return;
      }

      cursor += 1;
      const nextSnapshot = timeline[cursor];
      const delayMs = Math.max(480, snapshot.durationMs ?? FRAME_DURATION_MS);
      const timer = setTimeout(() => {
        void playFrame();
      }, delayMs);
      this.activeTimers.set(matchId, timer);
    };

    void playFrame();
  }

  private stopPlayback(matchId: string) {
    const timer = this.activeTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(matchId);
    }
  }
}
