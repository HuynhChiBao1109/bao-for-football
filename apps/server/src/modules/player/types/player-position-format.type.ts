import { EPlayerPosition } from "../enum/player-position.enum";

export type PlayerPositionFormat = {
  position: EPlayerPosition;
  rating: number; // 0 .. 1
};
