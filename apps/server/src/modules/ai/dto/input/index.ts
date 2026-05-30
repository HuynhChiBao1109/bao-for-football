export interface ListStagesInputDto {
  userId: number;
}

export interface GetStageDetailInputDto {
  userId: number;
  stageNo: number;
}

export interface SubmitStageResultInputDto {
  userId: number;
  stageNo: number;
  isWin: boolean;
}
