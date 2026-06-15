import { Module } from "@nestjs/common";
import { PlayerModule } from "../player/player.module";
import { TrainingRoomController } from "./training-room.controller";
import { TrainingRoomService } from "./training-room.service";

@Module({
  imports: [PlayerModule],
  controllers: [TrainingRoomController],
  providers: [TrainingRoomService],
})
export class TrainingRoomModule {}
