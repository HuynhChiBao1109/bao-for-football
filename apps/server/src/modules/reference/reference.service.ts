import { Injectable } from "@nestjs/common";
import { IReferenceService } from "./interfaces/reference-service.interface";
import { ReferenceRepository } from "./reference.repository";
import { ClubEntity } from "./entities/club.entity.";
import { LeagueEntity } from "./entities/league.entity";
import { CountryEntity } from "./entities/country.entity";

@Injectable()
export class ReferenceService implements IReferenceService {
  constructor(private readonly repository: ReferenceRepository) {}

  async getListClubByLeague(leagueId: bigint): Promise<ClubEntity[]> {
    return this.repository.getListClubByLeague(leagueId);
  }

  async getListLeagueByCountry(countryId: bigint): Promise<LeagueEntity[]> {
    return this.repository.getListLeagueByCountry(countryId);
  }

  async getListCountry(): Promise<CountryEntity[]> {
    return this.repository.getListCountry();
  }
}
