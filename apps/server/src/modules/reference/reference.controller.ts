import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ReferenceService } from "./reference.service";
import { Public } from "src/common/decorations/public.decoration";

@ApiTags("reference")
@Controller("api/v1/reference")
export class ReferenceController {
  constructor(private readonly referenceService: ReferenceService) {}

  @Get("clubs")
  @Public()
  async getListClubByLeague(@Param("leagueId") leagueId: bigint) {
    return this.referenceService.getListClubByLeague(leagueId);
  }

  @Get("leagues")
  @Public()
  async getListLeagueByCountry(@Param("countryId") countryId: bigint) {
    return this.referenceService.getListLeagueByCountry(countryId);
  }

  @Get("countries")
  @Public()
  async getListCountry() {
    return this.referenceService.getListCountry();
  }
}
