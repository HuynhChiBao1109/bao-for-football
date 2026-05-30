import { BadRequestException, Injectable } from "@nestjs/common";
import { AiServiceInterface } from "./interfaces/ai-service.interface";
import { AiRepository } from "./ai.repository";

@Injectable()
export class AiService implements AiServiceInterface {
  constructor(private readonly repository: AiRepository) {}

  async listStages(userId: number) {
    return { data: await this.repository.listStages(userId) };
  }

  async getStageDetail(userId: number, stageNo: number) {
    if (stageNo < 1 || stageNo > 50) {
      throw new BadRequestException("stageNo must be between 1 and 50");
    }
    const detail = await this.repository.getStageDetail(userId, stageNo);
    if (!detail) {
      throw new BadRequestException("stage not found");
    }
    return { data: detail };
  }

  async submitResult(userId: number, stageNo: number, isWin: boolean) {
    if (stageNo < 1 || stageNo > 50) {
      throw new BadRequestException("stageNo must be between 1 and 50");
    }
    const result = await this.repository.applyStageResult(
      userId,
      stageNo,
      isWin,
    );
    if (!result) {
      throw new BadRequestException("stage not found");
    }
    return { data: result };
  }
}
