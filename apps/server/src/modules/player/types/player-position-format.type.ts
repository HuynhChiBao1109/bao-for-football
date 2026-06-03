import { EPlayerPosition } from "../enum/player-position.enum";

export type PlayerPositionFormat = {
  position: EPlayerPosition;
  percentage: number; // 0 .. 1
};
