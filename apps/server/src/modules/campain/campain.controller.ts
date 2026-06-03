import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CampainService } from "./campain.service";

@ApiTags("teams")
@Controller("api/v1/teams")
export class TeamController {
  constructor(private readonly campainService: CampainService) {}
}
