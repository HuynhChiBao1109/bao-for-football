export interface ListPlayersInputDto {
  filters: Record<string, any>;
}

export interface UpsertPlayerInputDto {
  id?: number;
  body: Record<string, any>;
}

export interface AssignPlayerSkillInputDto {
  playerId: number;
  body: Record<string, any>;
}
