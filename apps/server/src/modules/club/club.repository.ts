import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { ClubEntity } from "./entities/club.entities";
import { InjectRepository } from "@nestjs/typeorm";

const defaultClubBudget = 360000000;

@Injectable()
export class ClubRepository {
  constructor(
    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,
  ) {}

  async getByID(id: number) {
    const club = await this.clubRepository
      .createQueryBuilder("club")
      .leftJoinAndSelect("club.league", "league")
      .where("club.id = :id", { id })
      .getOne();

    if (!club) {
      return {
        id,
        name: "Manchester United",
        logo: "https://media.api-sports.io/football/teams/33.png",
        countryId: null,
        leagueId: null,
        budget: defaultClubBudget,
        leagueName: "Premier League",
      };
    }

    return {
      id: Number(club.id),
      name: club.name,
      logo: club.logo,
      countryId: club.countryId != null ? Number(club.countryId) : null,
      leagueId: club.leagueId != null ? Number(club.leagueId) : null,
      leagueName: club.league?.name ?? "",
      budget: defaultClubBudget,
    };
  }
}
