import { RealtimeEnvelope } from "../realtime.events";

export interface RealtimeServiceInterface {
  publish(event: string, data: any): void;
  subscribe(listener: (message: RealtimeEnvelope) => void): () => void;
  latest(matchId: string): RealtimeEnvelope | null;
  handleSubstitution(payload: {
    matchId?: string;
    teamId?: string;
    playerOutId?: number;
    playerInId?: number;
  }): { ok: boolean; data: any };
  startMatch(matchId: string, homeClubName: string, awayClubName: string): void;
}
