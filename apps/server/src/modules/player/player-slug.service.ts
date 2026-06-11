import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { PlayerEntity, PlayerSkillEntity } from "./entities/player-admin.entity";
import { getPlayerSkillSlug } from "./enum/player-skill.enum";

@Injectable()
export class PlayerSlugService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlayerSlugService.name);

  constructor(
    @InjectRepository(PlayerEntity)
    private readonly playerRepository: Repository<PlayerEntity>,

    @InjectRepository(PlayerSkillEntity)
    private readonly playerSkillRepository: Repository<PlayerSkillEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.backfillMissingPlayerSlugs();
    await this.backfillMissingSkillSlugs();
  }

  private async backfillMissingPlayerSlugs(): Promise<void> {
    const players = await this.playerRepository.find({
      where: [{ slug: IsNull() }, { slug: "" }],
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!players.length) {
      return;
    }

    for (const player of players) {
      player.slug = createSlug(player.name, `player-${player.id}`);
    }

    await this.playerRepository.save(players);
    this.logger.log(`Backfilled ${players.length} player slug(s)`);
  }

  private async backfillMissingSkillSlugs(): Promise<void> {
    const skills = await this.playerSkillRepository.find({
      where: [{ slug: IsNull() }, { slug: "" }],
      select: {
        id: true,
        skill: true,
        slug: true,
      },
    });

    if (!skills.length) {
      return;
    }

    for (const skill of skills) {
      skill.slug = getPlayerSkillSlug(skill.skill) ?? `skill-${skill.id}`;
    }

    await this.playerSkillRepository.save(skills);
    this.logger.log(`Backfilled ${skills.length} player skill slug(s)`);
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
