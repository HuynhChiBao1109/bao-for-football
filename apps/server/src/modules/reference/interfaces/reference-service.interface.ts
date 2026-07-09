import { ClubEntity } from "../entities/club.entity";
import { CountryEntity } from "../entities/country.entity";
import { LeagueEntity } from "../entities/league.entity";
import { PlayerEntity } from "../../player/entities/player-admin.entity";

export interface IReferenceService {
  getListClubByLeague(leagueId: number): Promise<ClubEntity[]>;

  getListLeague(): Promise<LeagueEntity[]>;

  getListLeagueByCountry(countryId: number): Promise<LeagueEntity[]>;

  getListCountry(): Promise<CountryEntity[]>;

  getPlayersByClub(clubId: number): Promise<PlayerEntity[]>;
}
