import { TacticsConfig } from "../tactics.repository";

export interface TacticsServiceInterface {
  save(config: TacticsConfig): Promise<TacticsConfig>;
  get(teamId: string): Promise<TacticsConfig | null>;
}
