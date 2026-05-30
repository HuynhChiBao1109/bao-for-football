export const MATCH_SUBSCRIBE_EVENT = "match.subscribe";
export const MATCH_SUBSTITUTE_EVENT = "match.substitute";
export const MATCH_LATEST_EVENT = "match.latest";
export const MATCH_UPDATE_EVENT = "match.update";
export const MATCH_STARTED_EVENT = "match.started";
export const MATCH_FINISHED_EVENT = "match.finished";

export interface RealtimeEnvelope<T = any> {
  event: string;
  data: T;
  matchId?: string;
}

export interface MatchSubscriptionPayload {
  matchId?: string;
}

export interface MatchSubstitutionPayload {
  matchId?: string;
  teamId?: string;
  playerOutId?: number;
  playerInId?: number;
}
