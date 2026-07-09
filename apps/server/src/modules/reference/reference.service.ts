import { Injectable } from "@nestjs/common";
import { IReferenceService } from "./interfaces/reference-service.interface";
import { ReferenceRepository } from "./reference.repository";
import { ClubEntity } from "./entities/club.entity";
import { LeagueEntity } from "./entities/league.entity";
import { CountryEntity } from "./entities/country.entity";
import { PlayerEntity } from "../player/entities/player-admin.entity";

@Injectable()
export class ReferenceService implements IReferenceService {
  constructor(private readonly repository: ReferenceRepository) {}

  async getListClubByLeague(leagueId: number): Promise<ClubEntity[]> {
    return this.repository.getListClubByLeague(leagueId);
  }

  async getListLeague(): Promise<LeagueEntity[]> {
    return this.repository.getListLeague();
  }

  async getListLeagueByCountry(countryId: number): Promise<LeagueEntity[]> {
    return this.repository.getListLeagueByCountry(countryId);
  }

  async getListCountry(): Promise<CountryEntity[]> {
    return this.repository.getListCountry();
  }

  async getClubById(clubId: number): Promise<ClubEntity> {
    return this.repository.getClubById(clubId);
  }

  async getPlayersByClub(clubId: number): Promise<PlayerEntity[]> {
    return this.repository.getPlayersByClub(clubId);
  }
}
