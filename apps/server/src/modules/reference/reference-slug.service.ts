import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { ClubEntity } from "./entities/club.entity";
import { CountryEntity } from "./entities/country.entity";

@Injectable()
export class ReferenceSlugService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ReferenceSlugService.name);

  constructor(
    @InjectRepository(CountryEntity)
    private readonly countryRepository: Repository<CountryEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubRepository: Repository<ClubEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.backfillCountrySlugs();
    await this.backfillClubSlugs();
  }

  private async backfillCountrySlugs(): Promise<void> {
    const countries = await this.countryRepository.find({
      where: [{ slug: IsNull() }, { slug: "" }],
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!countries.length) {
      return;
    }

    for (const country of countries) {
      country.slug = createSlug(country.name, `country-${country.id}`);
    }

    await this.countryRepository.save(countries);
    this.logger.log(`Backfilled ${countries.length} country slug(s)`);
  }

  private async backfillClubSlugs(): Promise<void> {
    const clubs = await this.clubRepository.find({
      where: [{ slug: IsNull() }, { slug: "" }],
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!clubs.length) {
      return;
    }

    for (const club of clubs) {
      club.slug = createSlug(club.name, `club-${club.id}`);
    }

    await this.clubRepository.save(clubs);
    this.logger.log(`Backfilled ${clubs.length} club slug(s)`);
  }
}

function createSlug(value: string | null | undefined, fallback: string): string {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}
