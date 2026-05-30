import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { SaveTacticsDto } from "./dto/input/save-tactics.dto";
import { TacticsService } from "./tactics.service";

@ApiTags("tactics")
@Controller("api/v1/tactics")
export class TacticsController {
  constructor(private readonly tacticsService: TacticsService) {}

  @Get(":teamId")
  async get(@Param("teamId") teamId: string) {
    const config = await this.tacticsService.get(teamId);
    if (!config) {
      return { error: "tactics not found" };
    }
    return { data: config };
  }

  @Post()
  async save(@Body() body: SaveTacticsDto) {
    const saved = await this.tacticsService.save(body as any);
    return {
      message: "tactics saved and pushed to match engine",
      data: saved,
    };
  }
}
