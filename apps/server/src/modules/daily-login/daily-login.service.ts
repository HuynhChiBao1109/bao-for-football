import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { AuthUser } from "../auth/types";
import { PlayerEntity, PlayerSkillEntity } from "../player/entities/player-admin.entity";
import { UserPlayerEntity, UserPlayerSkillEntity } from "../player/entities/player-user.entity";
import { TeamEntity } from "../team/entities/team.entity";
import {
  DAILY_LOGIN_REWARDS,
  DAILY_LOGIN_TIME_ZONE,
  DailyLoginReward,
} from "./daily-login.constants";
import { DailyLoginProgressEntity } from "./entities/daily-login-progress.entity";

type RewardState = "claimed" | "claimable" | "locked";

@Injectable()
export class DailyLoginService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DailyLoginProgressEntity)
    private readonly progressRepository: Repository<DailyLoginProgressEntity>,
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

  async getStatus(user: AuthUser) {
    const today = getGameDateKey();
    const progress = await this.progressRepository.findOne({ where: { userId: user.id } });
    const claimedDays = clampClaimedDays(progress?.claimedDays ?? 0);
    const completed = claimedDays >= DAILY_LOGIN_REWARDS.length;
    const canClaim = !completed && String(progress?.lastClaimDate ?? "") !== today;
    const playerSlugs = DAILY_LOGIN_REWARDS.filter(
      (reward): reward is Extract<DailyLoginReward, { type: "player" }> => reward.type === "player",
    ).map((reward) => reward.playerSlug);
    const players = await this.playerRepository.find({ where: { slug: In(playerSlugs) } });
    const playerBySlug = new Map(players.map((player) => [String(player.slug), player]));

    return {
      claimedDays,
      nextDay: completed ? null : claimedDays + 1,
      canClaim,
      completed,
      lastClaimDate: progress?.lastClaimDate ?? null,
      rewards: DAILY_LOGIN_REWARDS.map((reward) => ({
        day: reward.day,
        type: reward.type,
        label: reward.label,
        amount: reward.type === "money" ? reward.amount : undefined,
        player:
          reward.type === "player"
            ? toPlayerReward(playerBySlug.get(reward.playerSlug), reward.label)
            : undefined,
        state: getRewardState(reward.day, claimedDays, canClaim),
      })),
    };
  }

  async claim(user: AuthUser) {
    const today = getGameDateKey();
    const claimedReward = await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(DailyLoginProgressEntity)
        .values({ userId: user.id, claimedDays: 0 })
        .orIgnore()
        .execute();

      const progress = await manager.findOne(DailyLoginProgressEntity, {
        where: { userId: user.id },
        lock: { mode: "pessimistic_write" },
      });
      if (!progress) {
        throw new ServiceUnavailableException("Cannot initialize daily login progress.");
      }

      const claimedDays = clampClaimedDays(progress.claimedDays);
      if (claimedDays >= DAILY_LOGIN_REWARDS.length) {
        throw new ConflictException("All daily login rewards have already been claimed.");
      }
      if (String(progress.lastClaimDate ?? "") === today) {
        throw new ConflictException("Today's daily login reward has already been claimed.");
      }

      const reward = DAILY_LOGIN_REWARDS[claimedDays];
      let alreadyOwned = false;

      if (reward.type === "money") {
        const team = await manager.findOne(TeamEntity, {
          where: { userId: user.id },
          order: { id: "ASC" },
          lock: { mode: "pessimistic_write" },
        });
        if (!team) {
          throw new BadRequestException("Choose a club before claiming this reward.");
        }
        const budgetUpdate = await manager.increment(
          TeamEntity,
          { id: team.id },
          "budget",
          reward.amount,
        );
        if (budgetUpdate.affected !== 1) {
          throw new ServiceUnavailableException("Cannot apply the daily login money reward.");
        }
      } else {
        const player = await manager.findOne(PlayerEntity, {
          where: { slug: reward.playerSlug },
        });
        if (!player) {
          throw new ServiceUnavailableException(
            `Daily reward player '${reward.label}' is missing. Run the seed migration first.`,
          );
        }

        const ownedPlayer = await manager.findOne(UserPlayerEntity, {
          where: { userId: user.id, playerId: player.id },
        });
        alreadyOwned = Boolean(ownedPlayer);

        if (!ownedPlayer) {
          const userPlayer = await manager.save(
            UserPlayerEntity,
            manager.create(UserPlayerEntity, {
              userId: user.id,
              playerId: player.id,
              exp: 0,
              bonusAttack: 0,
              bonusDefense: 0,
              bonusAgility: 0,
              bonusPass: 0,
              bonusGoalkeeping: 0,
              positions: player.positions ?? [],
            }),
          );
          const skills = await manager.find(PlayerSkillEntity, {
            where: { playerId: player.id },
          });
          if (skills.length) {
            await manager.save(
              UserPlayerSkillEntity,
              skills.map((skill) =>
                manager.create(UserPlayerSkillEntity, {
                  userPlayerId: userPlayer.id,
                  skill: skill.skill,
                }),
              ),
            );
          }
        }
      }

      progress.claimedDays = reward.day;
      progress.lastClaimDate = today;
      if (reward.day === DAILY_LOGIN_REWARDS.length) {
        progress.completedAt = new Date();
      }
      await manager.save(DailyLoginProgressEntity, progress);

      return {
        day: reward.day,
        type: reward.type,
        label: reward.label,
        amount: reward.type === "money" ? reward.amount : undefined,
        alreadyOwned: reward.type === "player" ? alreadyOwned : undefined,
      };
    });

    return {
      ...(await this.getStatus(user)),
      claimedReward,
    };
  }
}

function getGameDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DAILY_LOGIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function clampClaimedDays(value: number): number {
  return Math.max(0, Math.min(DAILY_LOGIN_REWARDS.length, Number(value) || 0));
}

function getRewardState(day: number, claimedDays: number, canClaim: boolean): RewardState {
  if (day <= claimedDays) return "claimed";
  if (day === claimedDays + 1 && canClaim) return "claimable";
  return "locked";
}

function toPlayerReward(player: PlayerEntity | undefined, fallbackName: string) {
  return {
    id: player?.id ?? null,
    name: player?.name ?? fallbackName,
    slug: player?.slug ?? null,
    position: player?.positions?.[0]?.position ?? "CF",
  };
}
