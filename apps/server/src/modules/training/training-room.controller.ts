import { Body, Controller, Get, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorations/currentUser.decoration";
import { AuthUser } from "../auth/types";
import { TrainingRoomService } from "./training-room.service";
import { TrainingEventInput } from "./training-room.types";

@ApiTags("training-room")
@Controller("api/v1/training-room")
export class TrainingRoomController {
  constructor(private readonly trainingRoomService: TrainingRoomService) {}

  @Get()
  async getRoom(@CurrentUser() user: AuthUser) {
    return this.trainingRoomService.getRoom(user);
  }

  @Post("event")
  async triggerEvent(@CurrentUser() user: AuthUser, @Body() input: TrainingEventInput) {
    return this.trainingRoomService.triggerEvent(user, input);
  }
}
