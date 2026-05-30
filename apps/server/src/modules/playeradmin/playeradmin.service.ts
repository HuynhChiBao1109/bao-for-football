import { BadRequestException, Injectable } from "@nestjs/common";
import { PlayerAdminServiceInterface } from "./interfaces/playeradmin-service.interface";
import { PlayerAdminRepository } from "./playeradmin.repository";

@Injectable()
export class PlayerAdminService implements PlayerAdminServiceInterface {
  constructor(private readonly repository: PlayerAdminRepository) {}

  async listPlayers(filters: Record<string, any>) {
    return { data: await this.repository.listPlayers(filters) };
  }

  async detailPlayer(id: number) {
    return { data: await this.repository.detailPlayer(id) };
  }

  async createPlayer(body: any) {
    return {
      message: "player created",
      data: await this.repository.createPlayer(body),
    };
  }

  async updatePlayer(id: number, body: any) {
    return {
      message: "player updated",
      data: await this.repository.updatePlayer(id, body),
    };
  }

  async deletePlayer(id: number) {
    await this.repository.deletePlayer(id);
    return { message: "player deleted" };
  }

  async listCountries() {
    return { data: await this.repository.listCountries() };
  }

  async createCountry(body: any) {
    return {
      message: "country created",
      data: await this.repository.createCountry(body),
    };
  }

  async listLeagues() {
    return { data: await this.repository.listLeagues() };
  }

  async createLeague(body: any) {
    return {
      message: "league created",
      data: await this.repository.createLeague(body),
    };
  }

  async updateLeague(id: number, body: any) {
    return {
      message: "league updated",
      data: await this.repository.updateLeague(id, body),
    };
  }

  async deleteLeague(id: number) {
    await this.repository.deleteLeague(id);
    return { message: "league deleted" };
  }

  async createClub(body: any) {
    return {
      message: "club created",
      data: await this.repository.createClub(body),
    };
  }

  async listSkills() {
    return { data: await this.repository.listSkills() };
  }

  async createSkill(body: any) {
    return {
      message: "skill created",
      data: await this.repository.createSkill(body),
    };
  }

  async assignSkill(id: number, body: any) {
    if (!id || id <= 0) {
      throw new BadRequestException("playerId is required");
    }
    if (!body?.skillId && !body?.skillName) {
      throw new BadRequestException("skillId or skillName is required");
    }
    return {
      message: "skill assigned",
      data: await this.repository.assignSkill(id, body),
    };
  }

  async removeSkill(playerId: number, skillId: number) {
    if (!playerId || playerId <= 0) {
      throw new BadRequestException("playerId is required");
    }
    if (!skillId || skillId <= 0) {
      throw new BadRequestException("skillId is required");
    }
    await this.repository.removeSkill(playerId, skillId);
    return { message: "skill removed" };
  }
}
