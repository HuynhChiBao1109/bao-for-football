import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminOnly } from "../../common/decorations/adminOnly.decoration";
import { PlayerAdminService } from "./playeradmin.service";

@ApiTags("player-admin")
@AdminOnly()
@Controller("api/v1/admin")
export class PlayerAdminController {
  constructor(private readonly service: PlayerAdminService) {}

  @Get("players")
  list(@Query() query: Record<string, any>) {
    return this.service.listPlayers(query);
  }

  @Get("players/:id")
  detail(@Param("id") id: string) {
    return this.service.detailPlayer(Number(id));
  }

  @Post("players")
  create(@Body() body: any) {
    return this.service.createPlayer(body);
  }

  @Put("players/:id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.service.updatePlayer(Number(id), body);
  }

  @Delete("players/:id")
  delete(@Param("id") id: string) {
    return this.service.deletePlayer(Number(id));
  }

  @Get("countries")
  countries() {
    return this.service.listCountries();
  }

  @Post("countries")
  createCountry(@Body() body: any) {
    return this.service.createCountry(body);
  }

  @Get("leagues")
  leagues() {
    return this.service.listLeagues();
  }

  @Post("leagues")
  createLeague(@Body() body: any) {
    return this.service.createLeague(body);
  }

  @Put("leagues/:id")
  updateLeague(@Param("id") id: string, @Body() body: any) {
    return this.service.updateLeague(Number(id), body);
  }

  @Delete("leagues/:id")
  deleteLeague(@Param("id") id: string) {
    return this.service.deleteLeague(Number(id));
  }

  @Post("clubs")
  createClub(@Body() body: any) {
    return this.service.createClub(body);
  }

  @Get("skills")
  skills() {
    return this.service.listSkills();
  }

  @Post("skills")
  createSkill(@Body() body: any) {
    return this.service.createSkill(body);
  }

  @Post("players/:id/skills")
  assignSkill(@Param("id") id: string, @Body() body: any) {
    return this.service.assignSkill(Number(id), body);
  }

  @Delete("players/:id/skills/:skillId")
  removeSkill(@Param("id") id: string, @Param("skillId") skillId: string) {
    return this.service.removeSkill(Number(id), Number(skillId));
  }
}
