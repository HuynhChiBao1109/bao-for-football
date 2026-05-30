export interface MatchSubscribeInputDto {
  matchId: string;
}

export interface MatchSubstituteInputDto {
  matchId?: string;
  teamId?: string;
  playerOutId?: number;
  playerInId?: number;
}
