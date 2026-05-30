import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorations/public.decoration";
import { ClubService } from "./club.service";

@ApiTags("clubs")
@Controller("api/v1/clubs")
export class ClubController {
  constructor(private readonly clubService: ClubService) {}

  @Get(":id")
  @Public()
  async getClubByID(@Param("id", ParseIntPipe) id: number) {
    const club = await this.clubService.getClubById(id);
    if (!club) {
      throw new BadRequestException("club not found");
    }
    return club;
  }
}
