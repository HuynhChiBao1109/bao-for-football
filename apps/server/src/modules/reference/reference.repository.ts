import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { ClubEntity } from "./entities/club.entity";
import { LeagueEntity } from "./entities/league.entity";
import { CountryEntity } from "./entities/country.entity";

@Injectable()
export class ReferenceRepository {
  constructor(
    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,

    @InjectRepository(LeagueEntity)
    private readonly leagueRepository: Repository<LeagueEntity>,

    @InjectRepository(CountryEntity)
    private readonly countryRepository: Repository<CountryEntity>,
  ) {}

  async getListClubByLeague(leagueId: bigint): Promise<ClubEntity[]> {
    return await this.clubRepository.find({ where: { leagueId } });
  }

  async getListLeagueByCountry(countryId: bigint): Promise<LeagueEntity[]> {
    return await this.leagueRepository.find({ where: { countryId } });
  }

  async getListCountry(): Promise<CountryEntity[]> {
    return await this.countryRepository.find();
  }

  async getClubById(clubId: bigint): Promise<ClubEntity> {
    return await this.clubRepository.findOne({ where: { id: clubId } });
  }
}
