import { BadRequestException, Injectable } from "@nestjs/common";
import { PlayerServiceInterface } from "./interfaces/player-service.interface";
import { PlayerRepository } from "./player.repository";

@Injectable()
export class PlayerService implements PlayerServiceInterface {
  constructor(private readonly repository: PlayerRepository) {}

  async listMyCards(userId: number) {
    return { data: await this.repository.listMyCards(userId) };
  }

  async allocateStats(
    userId: number,
    playerUserId: number,
    body: Record<string, number>,
  ) {
    const normalized = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, Number(value ?? 0)]),
    );
    const totalDelta = Object.values(normalized).reduce(
      (sum, value) => sum + Number(value || 0),
      0,
    );
    if (totalDelta <= 0) {
      throw new BadRequestException("invalid stat allocation");
    }
    const updated = await this.repository.allocateStats(
      userId,
      playerUserId,
      normalized,
    );
    return { message: "stats allocated", data: updated };
  }
}
