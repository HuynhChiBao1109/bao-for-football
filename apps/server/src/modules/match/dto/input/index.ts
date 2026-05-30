export interface StartMatchInputDto {
  userId: number;
  awayClubName?: string;
  mode?: string;
  stageNo?: number;
}

export interface FinalizeMatchInputDto {
  matchId: string;
  payload: Record<string, any>;
}
