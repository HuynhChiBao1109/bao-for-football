export interface ListMyCardsInputDto {
  userId: number;
}

export interface AllocateStatsInputDto {
  userId: number;
  playerUserId: number;
  body: Record<string, number>;
}
