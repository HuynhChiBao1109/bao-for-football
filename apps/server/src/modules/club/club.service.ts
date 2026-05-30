import { Injectable } from "@nestjs/common";
import { ClubServiceInterface } from "./interfaces/club-service.interface";
import { ClubRepository } from "./club.repository";

@Injectable()
export class ClubService implements ClubServiceInterface {
  constructor(private readonly repository: ClubRepository) {}

  async getClubById(id: number) {
    return this.repository.getByID(id);
  }
}
