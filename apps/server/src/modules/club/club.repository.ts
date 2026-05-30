import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { DATABASE_CONNECTION } from "../../common/constants/app.constants";
import { ClubEntity } from "./entities/club.entities";

const defaultClubBudget = 360000000;

@Injectable()
export class ClubRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly dataSource: DataSource | null,
  ) {}

  async getByID(id: number) {
    if (!this.dataSource) {
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

    const repository = this.dataSource.getRepository(ClubEntity);
    const club = await repository
      .createQueryBuilder("club")
      .leftJoinAndSelect("club.league", "league")
      .where("club.id = :id", { id })
      .getOne();

    if (!club) {
      return null;
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
