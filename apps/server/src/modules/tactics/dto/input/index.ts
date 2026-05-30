import { SaveTacticsDto } from "./save-tactics.dto";

export interface SaveTacticsInputDto {
  config: SaveTacticsDto;
}

export interface GetTacticsInputDto {
  teamId: string;
}
