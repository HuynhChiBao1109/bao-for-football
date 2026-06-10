import { useEffect, useMemo, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { ESocketEvent } from '../enums/socket';
import { API_BASE_URL } from '../lib/apiClient';
import { normalizeSnapshot } from '../lib/normalizeMatchSnapshot';
import { useAuth } from './useAuth';
import { useMatch } from './useMatch';
import type { MatchSnapshot } from '../types';

const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || API_BASE_URL;
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/socket.io';

export type LiveMatchEvent = {
  id: string;
  minute: number;
  event: number | null;
  label: string;
  actorPlayerId?: string | null;
  teamSide?: 'home' | 'away' | null;
  createdAt: number;
};

type SnapshotPacket = {
  matchId?: number | string;
  snapshot?: Partial<MatchSnapshot> | null;
};

type MatchEventPacket = {
  matchId?: number | string;
  minute?: number;
  highlight?: Partial<MatchSnapshot['highlight']> | null;
};

type CompletedPacket = {
  matchId?: number | string;
  homeScore?: number;
  awayScore?: number;
};

function sameMatch(packetMatchId: unknown, matchId: string) {
  return !packetMatchId || String(packetMatchId) === matchId;
}

function toLiveEvent(packet: MatchEventPacket): LiveMatchEvent | null {
  const highlight = packet.highlight;
  if (!highlight?.event && !highlight?.label) {
    return null;
  }

  return {
    id: `${packet.minute ?? 0}-${highlight.event ?? 'event'}-${Date.now()}`,
    minute: Number(packet.minute ?? 0),
    event: highlight.event ?? null,
    label: highlight.label ?? 'Match event',
    actorPlayerId: highlight.actorPlayerId ? String(highlight.actorPlayerId) : null,
    teamSide: highlight.teamSide ?? null,
    createdAt: Date.now(),
  };
}

export function useMatchSocket(matchId: string | undefined) {
  const { token } = useAuth();
  const { data, isLoading, error } = useMatch(matchId);
  const [liveSnapshot, setLiveSnapshot] = useState<{
    matchId: string;
    snapshot: MatchSnapshot;
  } | null>(null);
  const [liveEvents, setLiveEvents] = useState<{
    matchId: string;
    events: LiveMatchEvent[];
  } | null>(null);
  const [liveStatus, setLiveStatus] = useState<{ matchId: string; status: string } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const initialSnapshot = useMemo(
    () => (data?.latestSnapshot ? normalizeSnapshot(data.latestSnapshot) : null),
    [data],
  );
  const initialEvents = useMemo(
    () =>
      (data?.matchEvents ?? [])
        .slice(-12)
        .reverse()
        .map((event, index) => ({
          id: String(event.id ?? `${event.minute}-${event.event}-${index}`),
          minute: Number(event.minute ?? 0),
          event: event.event ?? null,
          label: String(event.payload?.label ?? `Event ${event.event}`),
          actorPlayerId: event.actorPlayerId ? String(event.actorPlayerId) : null,
          teamSide: null,
          createdAt: -index,
        })),
    [data],
  );

  const snapshot =
    liveSnapshot && liveSnapshot.matchId === matchId ? liveSnapshot.snapshot : initialSnapshot;
  const events = liveEvents && liveEvents.matchId === matchId ? liveEvents.events : initialEvents;
  const status =
    liveStatus && liveStatus.matchId === matchId
      ? liveStatus.status
      : data?.status ?? (isLoading ? 'loading' : 'ready');

  useEffect(() => {
    if (!token || !matchId) {
      return;
    }

    const socket: Socket = io(SOCKET_BASE_URL, {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth: { token },
    });

    const joinMatch = () => {
      setIsConnected(true);
      socket.emit(ESocketEvent.MATCH_JOIN, { matchId });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleSnapshot = (packet: SnapshotPacket) => {
      if (!sameMatch(packet?.matchId, matchId) || !packet?.snapshot) {
        return;
      }
      setLiveSnapshot({ matchId, snapshot: normalizeSnapshot(packet.snapshot) });
      setLiveStatus({ matchId, status: packet.snapshot.matchStep ?? 'in_progress' });
    };

    const handleEvent = (packet: MatchEventPacket) => {
      if (!sameMatch(packet?.matchId, matchId)) {
        return;
      }
      const liveEvent = toLiveEvent(packet);
      if (!liveEvent) {
        return;
      }
      setLiveEvents((current) => ({
        matchId,
        events: [liveEvent, ...(current?.matchId === matchId ? current.events : [])].slice(0, 16),
      }));
    };

    const handleCompleted = (packet: CompletedPacket) => {
      if (!sameMatch(packet?.matchId, matchId)) {
        return;
      }
      setLiveStatus({ matchId, status: 'finished' });
      setLiveSnapshot((current) =>
        current?.matchId === matchId
          ? {
              matchId,
              snapshot: {
                ...current.snapshot,
                homeScore: Number(packet.homeScore ?? current.snapshot.homeScore),
                awayScore: Number(packet.awayScore ?? current.snapshot.awayScore),
                matchStep: 'full_time',
                phase: 'full_time',
              },
            }
          : current,
      );
    };

    socket.on('connect', joinMatch);
    socket.on('disconnect', handleDisconnect);
    socket.on(ESocketEvent.MATCH_SNAPSHOT, handleSnapshot);
    socket.on(ESocketEvent.MATCH_EVENT, handleEvent);
    socket.on(ESocketEvent.MATCH_COMPLETED, handleCompleted);
    socket.on('connect_error', handleDisconnect);

    return () => {
      socket.emit(ESocketEvent.MATCH_LEAVE, { matchId });
      socket.off('connect', joinMatch);
      socket.off('disconnect', handleDisconnect);
      socket.off(ESocketEvent.MATCH_SNAPSHOT, handleSnapshot);
      socket.off(ESocketEvent.MATCH_EVENT, handleEvent);
      socket.off(ESocketEvent.MATCH_COMPLETED, handleCompleted);
      socket.off('connect_error', handleDisconnect);
      socket.disconnect();
    };
  }, [matchId, token]);

  return useMemo(
    () => ({
      snapshot,
      events,
      status,
      isConnected,
      isLoading,
      error,
    }),
    [error, events, isConnected, isLoading, snapshot, status],
  );
}
