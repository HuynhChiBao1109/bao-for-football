export interface AiServiceInterface {
  listStages(userId: number): Promise<any>;
  getStageDetail(userId: number, stageNo: number): Promise<any>;
  submitResult(userId: number, stageNo: number, isWin: boolean): Promise<any>;
}
