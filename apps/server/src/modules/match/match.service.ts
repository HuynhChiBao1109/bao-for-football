import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IMatchService } from "./interfaces/match-service.interface";
import { MatchRepository } from "./match.repository";
import { MatchEntity } from "./entities/match.entity";
import { AuthUser } from "../auth/types";
import { EMatchStatus } from "./enums";
import {
  AUTO_TICK_INTERVAL_MS,
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
import { RedisService } from "../redis/redis.service";
import { getPlayerSkillSlug } from "../player/enum/player-skill.enum";
import { TeamEntity } from "../team/entities/team.entity";
import { PlayerAiService } from "../player/player-ai.service";

type MatchStartPayload = {
  matchId: string;
  homeLineup: unknown[];
  awayLineup: unknown[];
};

type MatchRuntimeState = {
  matchId: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  status: EMatchStatus;
  currentMinute: number;
  clockSeconds: number;
  homeScore: number;
  awayScore: number;
  homeLineup: unknown[];
  awayLineup: unknown[];
  timeline: MatchSnapshot[];
  latestSnapshot: MatchSnapshot | null;
  simulationSeed: number;
};

type MatchTickOptions = {
  emitSocket?: boolean;
};

type CampaignCompletionResult = {
  stageCleared: boolean;
  completedLevel: number;
  unlockedLevel: number | null;
  nextStageUnlocked: boolean;
  campaignCompleted: boolean;
  rewardGranted: number;
};

@Injectable()
export class MatchService implements IMatchService {
  private readonly autoTickTimers = new Map<number, NodeJS.Timeout>();
  private readonly autoTickInFlight = new Set<number>();

  constructor(
    private readonly repository: MatchRepository,
    private readonly socketService: SocketService,
    private readonly redisService: RedisService,
    private readonly playerAiService: PlayerAiService,
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

    const campaignLevel = await this.completePreviousCampaignProgress(
      Number(campaignMatch.campainId),
      Number(campaignMatch.level),
    );

    if (Number(campaignMatch.level) > campaignLevel) {
      throw new BadRequestException("Campaign match level is not unlocked yet");
    }

    const existingMatch = await this.repository.findMatchByCampaignMatchId(campaignMatchId);
    if (existingMatch) {
      if (existingMatch.status === EMatchStatus.IN_PROGRESS) {
        const runtimeState = await this.redisService.getJson<MatchRuntimeState>(
          this.getMatchRuntimeKey(existingMatch.id),
        );
        const runtimeTimeline = (runtimeState?.timeline ?? []).filter(Boolean);
        const persistedTimeline = ((existingMatch.timeline ?? []) as MatchSnapshot[]).filter(
          Boolean,
        );
        const hasStarted = Boolean(
          runtimeState?.latestSnapshot ||
          existingMatch.latestSnapshot ||
          runtimeTimeline.length ||
          persistedTimeline.length,
        );

        if (!hasStarted) {
          this.stopAutoTick(existingMatch.id);
          await this.waitForAutoTickToSettle(existingMatch.id);
          const settledRuntimeState = await this.redisService.getJson<MatchRuntimeState>(
            this.getMatchRuntimeKey(existingMatch.id),
          );
          const tickCompletedWhileSettling = Boolean(
            settledRuntimeState?.latestSnapshot ||
            settledRuntimeState?.timeline?.filter(Boolean).length,
          );

          if (tickCompletedWhileSettling) {
            return {
              matchId: String(existingMatch.id),
              homeLineup: settledRuntimeState?.homeLineup ?? existingMatch.homeLineup ?? [],
              awayLineup: settledRuntimeState?.awayLineup ?? existingMatch.awayLineup ?? [],
            };
          }

          const lineups = await this.buildKickoffLineups(homeTeam, awayTeam);
          await this.repository.update(existingMatch.id, {
            homeLineup: lineups.homeLineup,
            awayLineup: lineups.awayLineup,
            currentMinute: 0,
            clockSeconds: 0,
            homeScore: 0,
            awayScore: 0,
            latestSnapshot: null,
            timeline: [],
          });

          existingMatch.homeLineup = lineups.homeLineup;
          existingMatch.awayLineup = lineups.awayLineup;
          existingMatch.currentMinute = 0;
          existingMatch.clockSeconds = 0;
          existingMatch.homeScore = 0;
          existingMatch.awayScore = 0;
          existingMatch.latestSnapshot = null;
          existingMatch.timeline = [];

          await this.cacheMatchRuntimeState(existingMatch, {
            simulationSeed:
              settledRuntimeState?.simulationSeed ??
              runtimeState?.simulationSeed ??
              this.createSimulationSeed(existingMatch.id),
          });

          return {
            matchId: String(existingMatch.id),
            homeLineup: lineups.homeLineup,
            awayLineup: lineups.awayLineup,
          };
        }

        if (!runtimeState) {
          await this.cacheMatchRuntimeState(existingMatch, {
            simulationSeed: this.createSimulationSeed(existingMatch.id),
          });
        }

        return {
          matchId: String(existingMatch.id),
          homeLineup: runtimeState?.homeLineup ?? existingMatch.homeLineup ?? [],
          awayLineup: runtimeState?.awayLineup ?? existingMatch.awayLineup ?? [],
        };
      }

      if (existingMatch.status === EMatchStatus.FINISHED) {
        const campaignTeamWon = this.didCampaignTeamWin(existingMatch, Number(homeTeam.id));
        if (!campaignTeamWon) {
          const retryMatch = await this.resetMatch(existingMatch.id);
          return {
            matchId: String(retryMatch.id),
            homeLineup: retryMatch.homeLineup ?? [],
            awayLineup: retryMatch.awayLineup ?? [],
          };
        }

        await this.completeCampaignProgress(existingMatch.id);
        return {
          matchId: String(existingMatch.id),
          homeLineup: existingMatch.homeLineup ?? [],
          awayLineup: existingMatch.awayLineup ?? [],
        };
      }

      await this.repository.deleteById(existingMatch.id);
      await this.redisService.del(this.getMatchRuntimeKey(existingMatch.id));
    }

    const lineups = await this.buildKickoffLineups(homeTeam, awayTeam);

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

    await this.cacheMatchRuntimeState(match);

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

  async getNextTick(matchId: number, options: MatchTickOptions = {}) {
    const shouldEmitSocket = options.emitSocket ?? true;
    const runtimeState = await this.redisService.getJson<MatchRuntimeState>(
      this.getMatchRuntimeKey(matchId),
    );

    if (!runtimeState) {
      throw new NotFoundException(
        "Match runtime cache not found. Start the match before requesting ticks.",
      );
    }

    if (runtimeState.status !== EMatchStatus.IN_PROGRESS) {
      throw new BadRequestException("Match is not in progress");
    }

    const previousTicks = (runtimeState.timeline ?? []).filter(Boolean);
    const nextTick = generateNextMatchTick({
      previousTicks,
      homeLineup: (runtimeState.homeLineup ?? []) as any,
      awayLineup: (runtimeState.awayLineup ?? []) as any,
      homeTeamId: runtimeState.homeTeamId ?? null,
      simulationSeed: runtimeState.simulationSeed,
    });

    if (!nextTick) {
      throw new BadRequestException("No more debug ticks to generate");
    }

    const timeline = [...previousTicks, nextTick.snapshot];
    const isFinished = nextTick.snapshot.highlight?.event === EMatchEvent.MATCH_END;
    let campaignCompletion: CampaignCompletionResult | null = null;
    const nextRuntimeState: MatchRuntimeState = {
      ...runtimeState,
      status: isFinished ? EMatchStatus.FINISHED : EMatchStatus.IN_PROGRESS,
      currentMinute: nextTick.snapshot.minute,
      clockSeconds: nextTick.snapshot.second,
      homeScore: nextTick.snapshot.homeScore,
      awayScore: nextTick.snapshot.awayScore,
      homeLineup: nextTick.snapshot.homePlayers,
      awayLineup: nextTick.snapshot.awayPlayers,
      latestSnapshot: nextTick.snapshot,
      timeline,
    };

    await this.redisService.setJson(this.getMatchRuntimeKey(matchId), nextRuntimeState);

    if (isFinished) {
      await this.repository.update(matchId, {
        currentMinute: nextTick.snapshot.minute,
        clockSeconds: nextTick.snapshot.second,
        latestSnapshot: nextTick.snapshot,
        homeLineup: nextTick.snapshot.homePlayers,
        awayLineup: nextTick.snapshot.awayPlayers,
        homeScore: nextTick.snapshot.homeScore,
        awayScore: nextTick.snapshot.awayScore,
        status: EMatchStatus.FINISHED,
        endedAt: new Date(),
      });

      campaignCompletion = await this.completeCampaignProgress(matchId);
      nextTick.event.payload = {
        ...nextTick.event.payload,
        campaignCompletion,
      };
    }

    await this.repository.saveEvents([
      {
        matchId,
        event: nextTick.event.event,
        minute: nextTick.event.minute,
        teamId: nextTick.event.teamId,
        actorPlayerId: nextTick.event.actorPlayerId,
        secondaryPlayerId: nextTick.event.secondaryPlayerId,
        payload: nextTick.event.payload,
      },
    ]);

    if (shouldEmitSocket) {
      this.emitTickResult(matchId, nextTick.snapshot, isFinished, campaignCompletion);
    }

    return {
      ...nextTick,
      campaignCompletion,
    };
  }

  async startAutoTick(matchId: number) {
    if (this.autoTickTimers.has(matchId)) {
      return { matchId: String(matchId), autoTicking: true };
    }

    const scheduleTick = (delayMs: number) => {
      const timer = setTimeout(() => {
        void runTick();
      }, delayMs);
      this.autoTickTimers.set(matchId, timer);
    };

    const runTick = async () => {
      if (this.autoTickInFlight.has(matchId)) {
        if (this.autoTickTimers.has(matchId)) {
          scheduleTick(AUTO_TICK_INTERVAL_MS);
        }
        return;
      }

      const tickStartedAt = Date.now();
      this.autoTickInFlight.add(matchId);
      let shouldContinue = true;
      let nextDelayMs = AUTO_TICK_INTERVAL_MS;
      try {
        const nextTick = await this.getNextTick(matchId, { emitSocket: false });
        const isFinished = nextTick.snapshot.highlight?.event === EMatchEvent.MATCH_END;
        const snapshotDuration = Number(nextTick.snapshot.durationMs);
        nextDelayMs =
          Number.isFinite(snapshotDuration) && snapshotDuration > 0
            ? Math.max(120, Math.min(10_000, snapshotDuration))
            : AUTO_TICK_INTERVAL_MS;

        if (!this.autoTickTimers.has(matchId)) {
          return;
        }

        this.emitTickResult(
          matchId,
          nextTick.snapshot,
          isFinished,
          nextTick.campaignCompletion,
        );

        if (isFinished) {
          shouldContinue = false;
          this.stopAutoTick(matchId);
        }
      } catch (error) {
        shouldContinue = false;
        this.stopAutoTick(matchId);
        console.error(`Auto tick stopped for match ${matchId}`, error);
      } finally {
        this.autoTickInFlight.delete(matchId);
        if (shouldContinue && this.autoTickTimers.has(matchId)) {
          const tickProcessingMs = Date.now() - tickStartedAt;
          scheduleTick(Math.max(0, nextDelayMs - tickProcessingMs));
        }
      }
    };

    scheduleTick(0);

    return { matchId: String(matchId), autoTicking: true };
  }

  stopAutoTick(matchId: number) {
    const timer = this.autoTickTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      this.autoTickTimers.delete(matchId);
    }

    return { matchId: String(matchId), autoTicking: false };
  }

  async resetMatch(matchId: number): Promise<MatchEntity> {
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }

    this.stopAutoTick(matchId);
    await this.waitForAutoTickToSettle(matchId);
    this.autoTickInFlight.delete(matchId);
    await this.redisService.del(this.getMatchRuntimeKey(matchId));

    const [homeTeam, awayTeam] = await Promise.all([
      this.repository.findTeamById(Number(match.homeTeamId)),
      this.repository.findTeamById(Number(match.awayTeamId)),
    ]);

    if (!homeTeam || !awayTeam) {
      throw new BadRequestException("Match is missing team data");
    }

    const lineups = await this.buildKickoffLineups(homeTeam, awayTeam);
    await this.repository.resetMatchProgress(matchId, {
      homeLineup: lineups.homeLineup,
      awayLineup: lineups.awayLineup,
    });
    const resetMatch = await this.repository.findMatchById(matchId);
    if (!resetMatch) {
      throw new NotFoundException("Match not found");
    }

    await this.cacheMatchRuntimeState(resetMatch, {
      simulationSeed: this.createSimulationSeed(matchId),
    });
    return resetMatch;
  }

  async finalize(matchId: number, payload: Partial<MatchEntity>): Promise<MatchEntity> {
    await this.repository.update(matchId, payload);
    const match = await this.repository.findMatchById(matchId);
    if (!match) {
      throw new NotFoundException("Match not found");
    }
    return match;
  }

  private getMatchRuntimeKey(matchId: number) {
    return `match:${matchId}:runtime`;
  }

  private createSimulationSeed(matchId: number) {
    return Date.now() + matchId * 1009;
  }

  private async waitForAutoTickToSettle(matchId: number) {
    const maxWaitMs = AUTO_TICK_INTERVAL_MS + 250;
    const startedAt = Date.now();

    while (this.autoTickInFlight.has(matchId) && Date.now() - startedAt < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  private async cacheMatchRuntimeState(
    match: MatchEntity,
    options: { simulationSeed?: number } = {},
  ) {
    const runtimeState: MatchRuntimeState = {
      matchId: match.id,
      homeTeamId: match.homeTeamId ?? null,
      awayTeamId: match.awayTeamId ?? null,
      status: match.status,
      currentMinute: Number(match.currentMinute ?? 0),
      clockSeconds: Number(match.clockSeconds ?? 0),
      homeScore: Number(match.homeScore ?? 0),
      awayScore: Number(match.awayScore ?? 0),
      homeLineup: match.homeLineup ?? [],
      awayLineup: match.awayLineup ?? [],
      timeline: ((match.timeline ?? []) as MatchSnapshot[]).filter(Boolean),
      latestSnapshot: (match.latestSnapshot as MatchSnapshot | null) ?? null,
      simulationSeed: options.simulationSeed ?? this.createSimulationSeed(match.id),
    };

    await this.redisService.setJson(this.getMatchRuntimeKey(match.id), runtimeState);
  }

  private async completeCampaignProgress(
    matchId: number,
  ): Promise<CampaignCompletionResult | null> {
    const match = await this.repository.findMatchById(matchId);
    const campaignMatch = match?.campainMatch;
    const campaign = campaignMatch?.campain;

    if (!match || !campaignMatch || !campaign) {
      return null;
    }

    if (match.status !== EMatchStatus.FINISHED) {
      return null;
    }

    const completedLevel = Number(campaignMatch.level ?? 0);
    const nextLevel = completedLevel + 1;
    const currentLevel = Number(campaign.level ?? 1);
    const stageCleared = this.didCampaignTeamWin(match, Number(campaign.teamId));

    if (!stageCleared) {
      return {
        stageCleared: false,
        completedLevel,
        unlockedLevel: null,
        nextStageUnlocked: false,
        campaignCompleted: false,
        rewardGranted: 0,
      };
    }

    if (nextLevel <= currentLevel) {
      const nextStage = await this.repository.findCampaignMatchByLevel(
        Number(campaign.id),
        nextLevel,
      );
      return {
        stageCleared: true,
        completedLevel,
        unlockedLevel: nextStage ? nextLevel : null,
        nextStageUnlocked: Boolean(nextStage),
        campaignCompleted: !nextStage,
        rewardGranted: 0,
      };
    }

    const nextStage = await this.repository.findCampaignMatchByLevel(
      Number(campaign.id),
      nextLevel,
    );
    const completion = await this.repository.completeCampaignMatch({
      campaignId: campaign.id,
      teamId: campaign.teamId,
      nextLevel,
      reward: Number(campaignMatch.matchReward ?? 0),
    });

    return {
      stageCleared: true,
      completedLevel,
      unlockedLevel: nextStage ? nextLevel : null,
      nextStageUnlocked: Boolean(nextStage),
      campaignCompleted: !nextStage,
      rewardGranted: completion.progressUpdated
        ? Number(campaignMatch.matchReward ?? 0)
        : 0,
    };
  }

  private async completePreviousCampaignProgress(campaignId: number, targetLevel: number) {
    const previousMatches = await this.repository.findCampaignMatchesUpToLevel(
      campaignId,
      targetLevel,
    );
    let unlockedLevel = 1;

    for (const campaignMatch of previousMatches) {
      const match = campaignMatch.match;
      const campaign = campaignMatch.campain;
      const completedLevel = Number(campaignMatch.level ?? 0);

      if (completedLevel < unlockedLevel) {
        continue;
      }

      if (completedLevel > unlockedLevel) {
        break;
      }

      if (
        !match ||
        !campaign ||
        match.status !== EMatchStatus.FINISHED ||
        !this.didCampaignTeamWin(match, Number(campaign.teamId))
      ) {
        break;
      }

      const nextLevel = completedLevel + 1;
      if (nextLevel <= unlockedLevel) {
        continue;
      }

      await this.repository.completeCampaignMatch({
        campaignId: campaign.id,
        teamId: campaign.teamId,
        nextLevel,
        reward: Number(campaignMatch.matchReward ?? 0),
      });
      unlockedLevel = nextLevel;
    }

    return unlockedLevel;
  }

  private didCampaignTeamWin(match: MatchEntity, campaignTeamId: number) {
    const homeScore = Number(match.homeScore ?? 0);
    const awayScore = Number(match.awayScore ?? 0);

    if (Number(match.homeTeamId) === campaignTeamId) {
      return homeScore > awayScore;
    }

    if (Number(match.awayTeamId) === campaignTeamId) {
      return awayScore > homeScore;
    }

    return false;
  }

  private emitSnapshot(matchIdValue: number | string, snapshot: MatchSnapshot) {
    const matchId = String(matchIdValue);
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

  private emitTickResult(
    matchId: number | string,
    snapshot: MatchSnapshot,
    isFinished: boolean,
    campaignCompletion: CampaignCompletionResult | null = null,
  ) {
    this.emitSnapshot(matchId, snapshot);

    if (isFinished) {
      this.socketService.emitToRoom({
        roomId: `${ESocketChannel.MATCH}${String(matchId)}`,
        event: ESocketEvent.MATCH_COMPLETED,
        data: {
          matchId: String(matchId),
          homeScore: snapshot.homeScore,
          awayScore: snapshot.awayScore,
          campaignCompletion,
        },
      });
    }
  }

  private async buildKickoffLineups(homeTeam: TeamEntity, awayTeam: TeamEntity) {
    const [homePlayers, awayPlayers] = await Promise.all([
      this.buildTeamRoster(homeTeam.id, homeTeam.userId, homeTeam.teamName),
      this.buildTeamRoster(awayTeam.id, awayTeam.userId, awayTeam.teamName),
    ]);

    if (homePlayers.length < 11 || awayPlayers.length < 11) {
      throw new BadRequestException("One of the teams does not have enough players to start");
    }

    return prepareMatchKickoffLineups(
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

    const formationByUserPlayerId = formations.reduce<
      Record<
        string,
        {
          order: number;
          slotId: string | null;
          position: string | null;
          x: number | null;
          y: number | null;
        }
      >
    >((acc, item, index) => {
      const savedX = Number(item.position?.x);
      const savedY = Number(item.position?.y);
      acc[String(item.userPlayerId)] = {
        order: index,
        slotId: item.position?.slotId ? String(item.position.slotId) : null,
        position: item.position?.position ? String(item.position.position) : null,
        x:
          item.position?.x !== null && item.position?.x !== undefined && Number.isFinite(savedX)
            ? savedX
            : null,
        y:
          item.position?.y !== null && item.position?.y !== undefined && Number.isFinite(savedY)
            ? savedY
            : null,
      };
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
          slug: player.slug,
          aiProfile: this.playerAiService.getProfileForPlayer(player),
          savedSlotId: formationByUserPlayerId[String(item.id)]?.slotId ?? null,
          savedPosition: formationByUserPlayerId[String(item.id)]?.position ?? null,
          savedX: formationByUserPlayerId[String(item.id)]?.x ?? null,
          savedY: formationByUserPlayerId[String(item.id)]?.y ?? null,
          positions: (item.positions ?? []).map((position) => ({
            position: String(position.position),
            effect: Number(position.rating ?? 1),
          })),
          skills: skills.map((skill) => skill.skill),
          skillSlugs: skills.map((skill) => {
            const playerSkill = player.skills?.find((item) => item.skill === skill.skill);
            return playerSkill?.slug ?? getPlayerSkillSlug(skill.skill) ?? `skill-${skill.skill}`;
          }),
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
          (formationByUserPlayerId[String(left.userPlayerId)]?.order ?? Number.MAX_SAFE_INTEGER) -
          (formationByUserPlayerId[String(right.userPlayerId)]?.order ?? Number.MAX_SAFE_INTEGER),
      );
  }
}
