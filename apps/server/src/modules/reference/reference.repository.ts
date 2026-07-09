import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm/repository/Repository.js";
import { InjectRepository } from "@nestjs/typeorm/dist/common/typeorm.decorators";
import { ClubEntity } from "./entities/club.entity";
import { LeagueEntity } from "./entities/league.entity";
import { CountryEntity } from "./entities/country.entity";
import { PlayerEntity } from "../player/entities/player-admin.entity";

@Injectable()
export class ReferenceRepository {
  constructor(
    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,

    @InjectRepository(LeagueEntity)
    private readonly leagueRepository: Repository<LeagueEntity>,

    @InjectRepository(CountryEntity)
    private readonly countryRepository: Repository<CountryEntity>,

    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,
  ) {}

  async getListClubByLeague(leagueId: number): Promise<ClubEntity[]> {
    return await this.clubRepository.find({ where: { leagueId } });
  }

  async getListLeague(): Promise<LeagueEntity[]> {
    return await this.leagueRepository.find({
      relations: ["country"],
      order: { name: "ASC" },
    });
  }

  async getListLeagueByCountry(countryId: number): Promise<LeagueEntity[]> {
    return await this.leagueRepository.find({ where: { countryId } });
  }

  async getListCountry(): Promise<CountryEntity[]> {
    return await this.countryRepository.find();
  }

  async getClubById(clubId: number): Promise<ClubEntity> {
    return await this.clubRepository.findOne({ where: { id: clubId } });
  }

  async getPlayersByClub(clubId: number): Promise<PlayerEntity[]> {
    return await this.playerRepository.find({
      where: { clubId },
      relations: ["country", "skills"],
      order: { id: "ASC" },
    });
  }
}
