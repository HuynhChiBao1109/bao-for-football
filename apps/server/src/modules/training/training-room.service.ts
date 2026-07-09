import { Injectable } from "@nestjs/common";
import { AuthUser } from "../auth/types";
import { EMatchEvent } from "../match/enums";
import {
  MatchRenderPlayer,
  MatchSnapshot,
  SimulationEventDraft,
} from "../match/match-simulation.util";
import { EPlayerSkill, getPlayerSkillSlug } from "../player/enum/player-skill.enum";
import { PlayerService, UserPlayerCardResponse } from "../player/player.service";
import {
  TrainingBallState,
  TrainingEventInput,
  TrainingEventType,
  TrainingPlayerState,
  TrainingPoint,
  TrainingRoomState,
} from "./training-room.types";

const EVENT_LABEL: Record<TrainingEventType | "idle", string> = {
  idle: "Ready",
  warmup: "Warm Up",
  sprint: "Sprint",
  passing: "Pass Drill",
  pass_normal: "Normal Pass",
  pass_through: "Through Pass",
  pass_lob: "Lob Pass",
  shooting: "Shoot Drill",
  skill: "Skill Burst",
  dribble_magic: "Magic Dribble",
  dribble_lightning: "Lightning Dribble",
  tank_tackle: "Tank Tackle",
  free_kick_pass: "Free Kick Pass",
  free_kick_through: "Free Kick Through",
  free_kick_lob: "Free Kick Lob",
  free_kick_shoot: "Free Kick Shot",
};

@Injectable()
export class TrainingRoomService {
  constructor(private readonly playerService: PlayerService) {}

  async getRoom(user: AuthUser): Promise<TrainingRoomState> {
    const players = await this.playerService.getMyPlayers(user);
    const playerStates = this.buildInitialPlayerStates(players, {});
    const first = playerStates[0] ?? null;

    return {
      tick: 0,
      snapshot: this.buildSnapshot({
        tick: 0,
        players: playerStates,
        ball: {
          x: first?.x ?? 50,
          y: first?.y ?? 50,
          targetX: first?.x ?? 50,
          targetY: first?.y ?? 50,
          speed: 0,
          ownerPlayerId: first?.userPlayerId ?? null,
          path: first ? [{ x: first.x, y: first.y }] : [],
        },
        event: "idle",
        selectedPlayer: first,
      }),
      event: this.buildEventDraft(0, "idle", first, null),
      players,
      playerStates,
      ball: {
        x: first?.x ?? 50,
        y: first?.y ?? 50,
        targetX: first?.x ?? 50,
        targetY: first?.y ?? 50,
        speed: 0,
        ownerPlayerId: first?.userPlayerId ?? null,
        path: first ? [{ x: first.x, y: first.y }] : [],
      },
      metrics: {
        event: "idle",
        playerSpeed: 0,
        ballSpeed: 0,
        distance: 0,
        durationSeconds: 0,
      },
      eventLog: [],
    };
  }

  async triggerEvent(user: AuthUser, input: TrainingEventInput): Promise<TrainingRoomState> {
    const players = await this.playerService.getMyPlayers(user);
    const tick = Number(input.tick ?? 0) + 1;
    const activePlayers = this.pickActivePlayers(players, input.activePlayerIds);
    const playerStates = this.buildInitialPlayerStates(activePlayers, input.positions ?? {});
    const selected =
      playerStates.find((player) => player.userPlayerId === Number(input.selectedPlayerId)) ??
      playerStates[0] ??
      null;
    const event = input.event ?? "warmup";

    if (!selected) {
      return this.getRoom(user);
    }

    const result = this.resolveEvent(event, selected, playerStates, tick);
    const updatedPlayers = playerStates.map((player) =>
      player.userPlayerId === selected.userPlayerId
        ? {
            ...player,
            x: result.playerTarget.x,
            y: result.playerTarget.y,
            targetX: result.playerTarget.x,
            targetY: result.playerTarget.y,
            speed: result.playerSpeed,
            event,
          }
        : player,
    );

    return {
      tick,
      snapshot: this.buildSnapshot({
        tick,
        players: updatedPlayers,
        ball: result.ball,
        event,
        selectedPlayer: selected,
        secondaryPlayerId: result.ball.ownerPlayerId,
      }),
      event: this.buildEventDraft(tick, event, selected, result.ball.ownerPlayerId),
      players,
      playerStates: updatedPlayers,
      ball: result.ball,
      metrics: {
        event,
        playerSpeed: result.playerSpeed,
        ballSpeed: result.ball.speed,
        distance: result.distance,
        durationSeconds: result.durationSeconds,
      },
      eventLog: [
        {
          tick,
          event,
          label: EVENT_LABEL[event],
          playerName: selected.name,
        },
      ],
    };
  }

  private pickActivePlayers(
    players: UserPlayerCardResponse[],
    activePlayerIds?: number[],
  ): UserPlayerCardResponse[] {
    if (!activePlayerIds?.length) {
      return players;
    }

    const requested = new Set(activePlayerIds.map((id) => Number(id)).filter(Number.isFinite));
    const goalkeeper = players.find((player) => isGoalkeeper(player.positions[0]?.position));
    if (goalkeeper) {
      requested.add(goalkeeper.userPlayerId);
    }

    const picked = players.filter((player) => requested.has(player.userPlayerId));
    return picked.length ? picked : goalkeeper ? [goalkeeper] : players.slice(0, 1);
  }

  private buildInitialPlayerStates(
    players: UserPlayerCardResponse[],
    positions: Record<string, TrainingPoint>,
  ): TrainingPlayerState[] {
    return players.map((player, index) => {
      const provided = positions[String(player.userPlayerId)];
      const fallback = {
        x: 12 + (index % 6) * 15,
        y: 18 + (Math.floor(index / 6) % 5) * 16,
      };
      const point = provided ?? fallback;
      const pace = Number(player.totalStats.pace ?? 60);
      return {
        userPlayerId: player.userPlayerId,
        name: player.name,
        position: player.positions[0]?.position ?? "ANY",
        x: clamp(point.x, 5, 95),
        y: clamp(point.y, 7, 93),
        targetX: clamp(point.x, 5, 95),
        targetY: clamp(point.y, 7, 93),
        speed: round(2.8 + pace / 18),
        event: null,
      };
    });
  }

  private resolveEvent(
    event: TrainingEventType,
    selected: TrainingPlayerState,
    players: TrainingPlayerState[],
    tick: number,
  ) {
    const durationSeconds = 1;
    const playerSpeedBase = selected.speed;
    const isFreeKick = event.startsWith("free_kick");
    const isPassEvent = ["passing", "pass_normal", "pass_through", "pass_lob"].includes(event);
    const isLob = event === "pass_lob" || event === "free_kick_lob";
    const isThrough = event === "pass_through" || event === "free_kick_through";
    const isPassLikeFreeKick =
      event === "free_kick_pass" || event === "free_kick_through" || event === "free_kick_lob";
    const isShot = event === "shooting" || event === "skill" || event === "free_kick_shoot";
    const isMagicDribble = event === "dribble_magic";
    const isLightningDribble = event === "dribble_lightning";
    const isTankTackle = event === "tank_tackle";
    const dribbleTarget = {
      x: clamp(selected.x + (((tick + selected.userPlayerId) % 3) - 1) * 5, 6, 94),
      y: clamp(selected.y + (selected.y < 50 ? 18 : -18), 7, 93),
    };
    const lightningTarget = {
      x: clamp(selected.x + (((tick + selected.userPlayerId) % 5) - 2) * 5.5, 6, 94),
      y: clamp(selected.y + (selected.y < 50 ? 24 : -24), 7, 93),
    };
    const partner =
      players
        .filter((player) => player.userPlayerId !== selected.userPlayerId)
        .sort((left, right) => {
          const leftScore = partnerScore(left, selected, isThrough || isLob);
          const rightScore = partnerScore(right, selected, isThrough || isLob);
          return rightScore - leftScore;
        })[0] ?? selected;
    const playerTarget =
      event === "sprint"
        ? {
            x: clamp(selected.x + (((tick + selected.userPlayerId) % 3) - 1) * 5, 6, 94),
            y: clamp(selected.y + 13, 7, 93),
          }
        : event === "warmup"
          ? {
              x: clamp(selected.x + (tick % 2 === 0 ? 2.5 : -2.5), 6, 94),
              y: clamp(selected.y + (tick % 3 === 0 ? 2 : -2), 7, 93),
            }
          : isFreeKick
            ? { x: clamp(selected.x, 18, 82), y: clamp(selected.y, 18, 82) }
            : isLightningDribble
              ? lightningTarget
              : isMagicDribble
                ? dribbleTarget
                : isTankTackle
                  ? {
                      x: clamp(selected.x + (partner.x - selected.x) * 0.62, 6, 94),
                      y: clamp(selected.y + (partner.y - selected.y) * 0.62, 7, 93),
                    }
                  : { x: selected.x, y: selected.y };

    const passTarget = isThrough
      ? leadTarget(selected, partner, 14)
      : isLob
        ? leadTarget(selected, partner, 7)
        : { x: partner.x, y: partner.y };
    const freeKickBase = {
      x: clamp(selected.x < 50 ? selected.x + 8 : selected.x - 8, 10, 90),
      y: clamp(selected.y < 50 ? selected.y + 18 : selected.y - 18, 12, 88),
    };

    const ballTarget = isPassEvent
      ? passTarget
      : isPassLikeFreeKick
        ? partner.userPlayerId === selected.userPlayerId
          ? freeKickBase
          : passTarget
        : isLightningDribble
          ? lightningTarget
          : isMagicDribble
            ? dribbleTarget
            : isTankTackle
              ? playerTarget
              : isShot
                ? { x: 50 + (selected.x < 50 ? 7 : -7), y: 6 }
                : playerTarget;
    const ballPath =
      event === "skill"
        ? zigzagPath({ x: selected.x, y: selected.y }, ballTarget, 7)
        : isLightningDribble
          ? lightningDribblePath({ x: selected.x, y: selected.y }, ballTarget, 9)
          : isMagicDribble
            ? magicDribblePath({ x: selected.x, y: selected.y }, ballTarget, 8)
            : isTankTackle
              ? tankTacklePath({ x: partner.x, y: partner.y }, ballTarget, 7)
              : isLob
                ? lobPath({ x: selected.x, y: selected.y }, ballTarget, 9)
                : pathBetween({ x: selected.x, y: selected.y }, ballTarget, 7);
    const ballDistance = distance({ x: selected.x, y: selected.y }, ballTarget);
    const ballSpeed =
      event === "skill"
        ? 44
        : isLightningDribble
          ? 42
          : isMagicDribble
            ? 32
            : isTankTackle
              ? 34
              : isShot
                ? 38
                : isLob
                  ? 18
                  : isPassEvent || isPassLikeFreeKick
                    ? isThrough
                      ? 28
                      : 23
                    : 0;

    return {
      playerTarget,
      playerSpeed: round(
        event === "sprint"
          ? playerSpeedBase * 1.45
          : isLightningDribble
            ? playerSpeedBase * 2.05
            : isMagicDribble
              ? playerSpeedBase * 1.7
              : isTankTackle
                ? playerSpeedBase * 1.55
                : playerSpeedBase,
      ),
      ball: {
        x: ballTarget.x,
        y: ballTarget.y,
        targetX: ballTarget.x,
        targetY: ballTarget.y,
        speed: ballSpeed,
        ownerPlayerId:
          isPassEvent || isPassLikeFreeKick ? partner.userPlayerId : selected.userPlayerId,
        path: ballPath,
      } satisfies TrainingBallState,
      distance: round(ballDistance),
      durationSeconds,
    };
  }

  private buildSnapshot(input: {
    tick: number;
    players: TrainingPlayerState[];
    ball: TrainingBallState;
    event: TrainingEventType | "idle";
    selectedPlayer: TrainingPlayerState | null;
    secondaryPlayerId?: number | null;
  }): MatchSnapshot {
    const eventCode = this.toMatchEvent(input.event);
    const skill =
      input.event === "skill"
        ? EPlayerSkill.SHOOT_THUNDER
        : input.event === "dribble_magic"
          ? EPlayerSkill.DRIBBLE_MAGIC
          : input.event === "dribble_lightning"
            ? EPlayerSkill.LIGHTNING_DRIBBLE
            : input.event === "tank_tackle"
              ? EPlayerSkill.TANK_TACKLE
              : null;
    const ownerPlayerId = input.ball.ownerPlayerId ?? input.selectedPlayer?.userPlayerId ?? null;

    return {
      frameId: input.tick,
      tick: input.tick,
      durationMs: 1000,
      matchStep: "play",
      minute: 0,
      second: input.tick,
      clockLabel: `TR:${String(input.tick).padStart(2, "0")}`,
      phase: "first_half",
      homeScore: 0,
      awayScore: 0,
      possession: "home",
      ball: {
        x: input.ball.x,
        y: input.ball.y,
        fromX: input.selectedPlayer?.x ?? input.ball.x,
        fromY: input.selectedPlayer?.y ?? input.ball.y,
        ownerPlayerId,
        speed: input.ball.speed,
        trajectory: input.ball.path,
        skillTrajectory: skill,
      },
      homePlayers: input.players.map((player) =>
        this.toMatchRenderPlayer(
          player,
          ownerPlayerId,
          skill,
          input.selectedPlayer?.userPlayerId ?? null,
        ),
      ),
      awayPlayers: [],
      highlight: {
        event: eventCode,
        label: `${EVENT_LABEL[input.event]}${input.selectedPlayer ? ` - ${input.selectedPlayer.name}` : ""}`,
        teamSide: "home",
        actorPlayerId: input.selectedPlayer?.userPlayerId ?? null,
        secondaryPlayerId: input.secondaryPlayerId ?? null,
        skill,
        skillSlug: getPlayerSkillSlug(skill),
      },
    };
  }

  private toMatchRenderPlayer(
    player: TrainingPlayerState,
    ownerPlayerId: number | null,
    activeSkill: EPlayerSkill | null,
    selectedPlayerId: number | null,
  ): MatchRenderPlayer {
    const direction = normalizeVector({
      x: player.targetX - player.x,
      y: player.targetY - player.y,
    });

    return {
      userPlayerId: player.userPlayerId,
      playerId: player.userPlayerId,
      teamId: 0,
      side: "home",
      role: player.position,
      displayRole: player.position,
      name: player.name,
      shortName: getShortName(player.name),
      slug: null,
      skillSlugs: [],
      x: player.x,
      y: player.y,
      homeX: player.x,
      homeY: player.y,
      vx: 0,
      vy: 0,
      targetX: player.targetX,
      targetY: player.targetY,
      aiState:
        player.event === "sprint" ||
        player.event === "dribble_magic" ||
        player.event === "dribble_lightning"
          ? "DRIBBLE"
          : player.event === "tank_tackle"
            ? "PRESS_BALL"
            : isTrainingPassEvent(player.event)
              ? "RECEIVE_PASS"
              : "HOLD_POSITION",
      stamina: 100,
      activeSkill: selectedPlayerId === player.userPlayerId ? activeSkill : null,
      hasBall: ownerPlayerId === player.userPlayerId,
      move: {
        fromX: player.x,
        fromY: player.y,
        toX: player.targetX,
        toY: player.targetY,
        intent:
          player.event === "sprint" ||
          player.event === "dribble_magic" ||
          player.event === "dribble_lightning"
            ? "run"
            : player.event === "tank_tackle"
              ? "press"
              : isTrainingPassEvent(player.event)
                ? "support"
                : "anchor",
        directionX: direction.x,
        directionY: direction.y,
        targetX: player.targetX,
        targetY: player.targetY,
      },
    };
  }

  private buildEventDraft(
    tick: number,
    event: TrainingEventType | "idle",
    selected: TrainingPlayerState | null,
    secondaryPlayerId: number | null,
  ): SimulationEventDraft {
    return {
      event: this.toMatchEvent(event) ?? EMatchEvent.DRIBBLE,
      minute: tick,
      teamId: null,
      actorPlayerId: selected?.userPlayerId ?? null,
      secondaryPlayerId,
      payload: {
        trainingEvent: event,
        label: EVENT_LABEL[event],
        tick,
      },
    };
  }

  private toMatchEvent(event: TrainingEventType | "idle"): EMatchEvent | null {
    if (event.startsWith("free_kick")) return EMatchEvent.FREE_KICK;
    if (isTrainingPassEvent(event)) return EMatchEvent.PASS;
    if (event === "shooting") return EMatchEvent.SHOOT;
    if (
      event === "skill" ||
      event === "dribble_magic" ||
      event === "dribble_lightning" ||
      event === "tank_tackle"
    ) {
      return EMatchEvent.SKILL_USED;
    }
    if (event === "sprint") return EMatchEvent.DRIBBLE;
    if (event === "warmup") return EMatchEvent.DRIBBLE;
    return null;
  }
}

function pathBetween(from: TrainingPoint, to: TrainingPoint, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return {
      x: round(from.x + (to.x - from.x) * progress),
      y: round(from.y + (to.y - from.y) * progress),
    };
  });
}

function zigzagPath(from: TrainingPoint, to: TrainingPoint, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    const wave = Math.sin(progress * Math.PI * 5) * (8 - progress * 3);
    return {
      x: clamp(round(from.x + (to.x - from.x) * progress + wave), 4, 96),
      y: clamp(round(from.y + (to.y - from.y) * progress), 4, 96),
    };
  });
}

function magicDribblePath(from: TrainingPoint, to: TrainingPoint, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    const burst = progress > 0.35 ? 1.18 : 0.72;
    const sidestep = Math.sin(progress * Math.PI * 2) * 5.8;
    return {
      x: clamp(round(from.x + (to.x - from.x) * progress * burst + sidestep), 4, 96),
      y: clamp(round(from.y + (to.y - from.y) * progress * burst), 4, 96),
    };
  });
}

function lightningDribblePath(from: TrainingPoint, to: TrainingPoint, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    const burst = progress < 0.58 ? progress * 1.34 : 1 - (progress - 0.58) * 0.34;
    const feint = Math.sin(progress * Math.PI * 4.8) * (7.8 - progress * 3.8);
    const snap = Math.sin(progress * Math.PI * 9) * (1 - progress) * 2.2;

    return {
      x: clamp(round(from.x + (to.x - from.x) * burst + feint + snap), 4, 96),
      y: clamp(round(from.y + (to.y - from.y) * Math.min(1, progress * 1.18)), 4, 96),
    };
  });
}

function tankTacklePath(from: TrainingPoint, to: TrainingPoint, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    const impact = progress < 0.35 ? progress * 0.55 : 0.35 + (progress - 0.35) * 1.28;
    const shake = Math.sin(progress * Math.PI * 5) * (1 - progress) * 3.2;
    return {
      x: clamp(round(from.x + (to.x - from.x) * impact + shake), 4, 96),
      y: clamp(round(from.y + (to.y - from.y) * impact), 4, 96),
    };
  });
}

function lobPath(from: TrainingPoint, to: TrainingPoint, steps: number) {
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    const arc = Math.sin(progress * Math.PI) * 5.5;
    return {
      x: clamp(round(from.x + (to.x - from.x) * progress - arc), 4, 96),
      y: clamp(round(from.y + (to.y - from.y) * progress), 4, 96),
    };
  });
}

function distance(a: TrainingPoint, b: TrainingPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function partnerScore(
  player: TrainingPlayerState,
  selected: TrainingPlayerState,
  preferForward: boolean,
) {
  const spacing = Math.min(28, distance(player, selected));
  const forward = selected.y < 50 ? player.y - selected.y : selected.y - player.y;
  return spacing + (preferForward ? forward * 1.2 : -Math.abs(forward) * 0.2);
}

function leadTarget(
  selected: TrainingPlayerState,
  receiver: TrainingPlayerState,
  lead: number,
): TrainingPoint {
  const direction = normalizeVector({
    x: receiver.x - selected.x,
    y: receiver.y - selected.y,
  });

  return {
    x: clamp(receiver.x + direction.x * lead, 5, 95),
    y: clamp(receiver.y + direction.y * lead, 7, 93),
  };
}

function isGoalkeeper(position: string | undefined) {
  return String(position ?? "").toUpperCase() === "GK";
}

function isTrainingPassEvent(event: TrainingEventType | "idle" | null | undefined) {
  return (
    event === "passing" ||
    event === "pass_normal" ||
    event === "pass_through" ||
    event === "pass_lob" ||
    event === "free_kick_pass" ||
    event === "free_kick_through" ||
    event === "free_kick_lob"
  );
}

function normalizeVector(vector: TrainingPoint) {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.001) {
    return { x: 0, y: 0 };
  }
  return {
    x: round(vector.x / length),
    y: round(vector.y / length),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, round(value)));
}

function round(value: number) {
  return Number(value.toFixed(2));
}

function getShortName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "Player";
  return parts[parts.length - 1];
}
