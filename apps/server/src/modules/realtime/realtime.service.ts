import { Injectable } from "@nestjs/common";
import {
  MATCH_STARTED_EVENT,
  MATCH_SUBSTITUTE_EVENT,
  RealtimeEnvelope,
} from "./realtime.events";
import { RealtimeServiceInterface } from "./interfaces/realtime-service.interface";

@Injectable()
export class RealtimeService implements RealtimeServiceInterface {
  private readonly listeners = new Set<(message: RealtimeEnvelope) => void>();
  private readonly latestByMatch = new Map<string, RealtimeEnvelope>();

  publish(event: string, data: any) {
    const message: RealtimeEnvelope = {
      event,
      data,
      matchId: data?.matchId ? String(data.matchId) : undefined,
    };

    if (message.matchId) {
      this.latestByMatch.set(message.matchId, message);
    }

    for (const listener of this.listeners) {
      listener(message);
    }
  }

  subscribe(listener: (message: RealtimeEnvelope) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  latest(matchId: string) {
    return this.latestByMatch.get(matchId) ?? null;
  }

  handleSubstitution(payload: {
    matchId?: string;
    teamId?: string;
    playerOutId?: number;
    playerInId?: number;
  }) {
    this.publish(MATCH_SUBSTITUTE_EVENT, {
      matchId: payload.matchId,
      teamId: payload.teamId,
      playerOutId: payload.playerOutId,
      playerInId: payload.playerInId,
    });

    return {
      ok: true,
      data: {
        matchId: payload.matchId,
        teamId: payload.teamId,
        playerOutId: payload.playerOutId,
        playerInId: payload.playerInId,
      },
    };
  }

  startMatch(matchId: string, homeClubName: string, awayClubName: string) {
    this.publish(MATCH_STARTED_EVENT, { matchId, homeClubName, awayClubName });
  }
}
