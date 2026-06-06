import { ClubEntity } from "../entities/club.entity";
import { CountryEntity } from "../entities/country.entity";
import { LeagueEntity } from "../entities/league.entity";

export interface IReferenceService {
  getListClubByLeague(leagueId: number): Promise<ClubEntity[]>;

  getListLeagueByCountry(countryId: number): Promise<LeagueEntity[]>;

  getListCountry(): Promise<CountryEntity[]>;
}
