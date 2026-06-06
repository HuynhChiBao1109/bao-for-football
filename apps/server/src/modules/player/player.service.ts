import { BadRequestException, Injectable } from "@nestjs/common";
import { IPlayerService } from "./interfaces/player-service.interface";
import { PlayerRepository } from "./player.repository";
import { AuthUser } from "../auth/types";

@Injectable()
export class PlayerService implements IPlayerService {
  constructor(private readonly repository: PlayerRepository) {}

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
}
