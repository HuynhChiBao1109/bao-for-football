import { ClubEntity } from "../entities/club.entity";
import { CountryEntity } from "../entities/country.entity";
import { LeagueEntity } from "../entities/league.entity";

export interface IReferenceService {
  getListClubByLeague(leagueId: bigint): Promise<ClubEntity[]>;

  getListLeagueByCountry(countryId: bigint): Promise<LeagueEntity[]>;

  getListCountry(): Promise<CountryEntity[]>;
}
