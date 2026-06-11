import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ClubEntity } from "../reference/entities/club.entity";
import { TeamEntity } from "./entities/team.entity";

@Injectable()
export class TeamImageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TeamImageService.name);

  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const clubs = await this.clubRepository.find({
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    const clubSlugByName = new Map<string, string>(
      clubs
        .filter((club) => Boolean(club.slug))
        .map((club) => [normalizeKey(club.name), String(club.slug)]),
    );

    const teams = await this.teamRepository.find({
      select: {
        id: true,
        teamName: true,
        imgUrl: true,
      },
    });

    const updates: Array<Promise<unknown>> = [];
    for (const team of teams) {
      const slug = clubSlugByName.get(normalizeKey(team.teamName));
      if (!slug) {
        continue;
      }

      const nextImgUrl = `/clubs/${slug}.svg`;
      if (String(team.imgUrl || "") === nextImgUrl) {
        continue;
      }

      updates.push(this.teamRepository.update({ id: team.id }, { imgUrl: nextImgUrl }));
    }

    if (updates.length) {
      await Promise.all(updates);
      this.logger.log(`Backfilled ${updates.length} team image(s)`);
    }
  }
}

function normalizeKey(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
