import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ESocketEvent } from '../enums/socket';
import { normalizeSnapshot } from '../lib/normalizeMatchSnapshot';
import { useMatch } from './useMatch';
import { useSocketSession } from './useSocketSession';
import type { MatchSnapshot } from '../types';

const MAX_TICK_QUEUE = 80;
const MAX_EVENTS = 16;

export type LiveMatchEvent = {
  id: string;
  minute: number;
  event: number | null;
  label: string;
  actorPlayerId?: string | null;
  teamSide?: 'home' | 'away' | null;
  frameId?: number;
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

type TickBuffer = {
  matchId: string;
  active: MatchSnapshot | null;
  queue: MatchSnapshot[];
  lastAcceptedFrameId: number;
};

function sameMatch(packetMatchId: unknown, matchId: string) {
  return !packetMatchId || String(packetMatchId) === matchId;
}

function frameIdOf(snapshot: Partial<MatchSnapshot> | null | undefined) {
  return Number(snapshot?.frameId ?? snapshot?.tick ?? -1);
}

function eventKey(event: LiveMatchEvent) {
  return `${event.frameId ?? 'db'}:${event.minute}:${event.event ?? 'none'}:${event.actorPlayerId ?? 'none'}:${event.label}`;
}

function eventFromSnapshot(snapshot: MatchSnapshot): LiveMatchEvent | null {
  const highlight = snapshot.highlight;
  if (!highlight?.event && !highlight?.label) {
    return null;
  }

  return {
    id: `${snapshot.frameId ?? snapshot.tick}-${snapshot.minute}-${highlight.event ?? 'event'}-${highlight.actorPlayerId ?? 'none'}`,
    minute: Number(snapshot.minute ?? 0),
    event: highlight.event ?? null,
    label: highlight.label ?? 'Match event',
    actorPlayerId: highlight.actorPlayerId ? String(highlight.actorPlayerId) : null,
    teamSide: highlight.teamSide ?? null,
    frameId: frameIdOf(snapshot),
    createdAt: frameIdOf(snapshot),
  };
}

function eventFromPacket(packet: MatchEventPacket): LiveMatchEvent | null {
  const highlight = packet.highlight;
  if (!highlight?.event && !highlight?.label) {
    return null;
  }

  return {
    id: `${packet.minute ?? 0}-${highlight.event ?? 'event'}-${highlight.actorPlayerId ?? 'none'}`,
    minute: Number(packet.minute ?? 0),
    event: highlight.event ?? null,
    label: highlight.label ?? 'Match event',
    actorPlayerId: highlight.actorPlayerId ? String(highlight.actorPlayerId) : null,
    teamSide: highlight.teamSide ?? null,
    createdAt: Number(packet.minute ?? 0),
  };
}

function pushUniqueEvent(events: LiveMatchEvent[], event: LiveMatchEvent | null) {
  if (!event) {
    return events;
  }

  const next = [event, ...events.filter((item) => eventKey(item) !== eventKey(event))];
  return next.slice(0, MAX_EVENTS);
}

function sortSnapshots(left: MatchSnapshot, right: MatchSnapshot) {
  return frameIdOf(left) - frameIdOf(right);
}

export function useMatchSocket(matchId: string | undefined) {
  const { socket, isConnected } = useSocketSession();
  const { data, isLoading, error } = useMatch(matchId);
  const initialFrameIdRef = useRef(-1);
  const [tickBuffer, setTickBuffer] = useState<TickBuffer | null>(null);
  const [liveEvents, setLiveEvents] = useState<{
    matchId: string;
    events: LiveMatchEvent[];
  } | null>(null);
  const pendingSocketEventsRef = useRef<{
    matchId: string;
    events: LiveMatchEvent[];
  } | null>(null);
  const [liveStatus, setLiveStatus] = useState<{ matchId: string; status: string } | null>(null);

  const initialSnapshot = useMemo(
    () => (data?.latestSnapshot ? normalizeSnapshot(data.latestSnapshot) : null),
    [data],
  );

  useEffect(() => {
    initialFrameIdRef.current = frameIdOf(initialSnapshot);
  }, [initialSnapshot]);

  const initialEvents = useMemo(() => [], []);

  const activeLiveSnapshot =
    tickBuffer && tickBuffer.matchId === matchId ? tickBuffer.active : null;
  const snapshot = activeLiveSnapshot ?? initialSnapshot;
  const events = liveEvents && liveEvents.matchId === matchId ? liveEvents.events : initialEvents;
  const queuedTicks = tickBuffer && tickBuffer.matchId === matchId ? tickBuffer.queue.length : 0;
  const status =
    liveStatus && liveStatus.matchId === matchId
      ? liveStatus.status
      : data?.status ?? (isLoading ? 'loading' : 'ready');

  const promoteSnapshotEvent = useCallback(
    (snapshotToPromote: MatchSnapshot) => {
      if (!matchId) {
        return;
      }

      const snapshotEvent = eventFromSnapshot(snapshotToPromote);
      const matchingSocketEvent =
        pendingSocketEventsRef.current?.matchId === matchId
          ? pendingSocketEventsRef.current.events.find(
              (event) =>
                event.minute === snapshotEvent?.minute &&
                event.event === snapshotEvent?.event &&
                event.actorPlayerId === snapshotEvent?.actorPlayerId,
            )
          : null;

      setLiveEvents((current) => ({
        matchId,
        events: pushUniqueEvent(
          current?.matchId === matchId ? current.events : [],
          matchingSocketEvent ?? snapshotEvent,
        ),
      }));
      setLiveStatus({ matchId, status: snapshotToPromote.matchStep ?? 'in_progress' });
    },
    [matchId],
  );

  const ackActiveTick = useCallback(
    (completedSnapshot: MatchSnapshot) => {
      if (!matchId) {
        return;
      }

      setTickBuffer((current) => {
        if (!current || current.matchId !== matchId) {
          return current;
        }

        if (frameIdOf(current.active) !== frameIdOf(completedSnapshot)) {
          return current;
        }

        const [nextActive, ...restQueue] = current.queue;
        if (!nextActive) {
          return current;
        }

        promoteSnapshotEvent(nextActive);
        return {
          ...current,
          active: nextActive,
          queue: restQueue,
        };
      });
    },
    [matchId, promoteSnapshotEvent],
  );

  useEffect(() => {
    if (!socket || !matchId) {
      return;
    }

    const joinMatch = () => {
      socket.emit(ESocketEvent.MATCH_JOIN, { matchId });
    };

    const handleSnapshot = (packet: SnapshotPacket) => {
      if (!sameMatch(packet?.matchId, matchId) || !packet?.snapshot) {
        return;
      }

      const snapshotTick = normalizeSnapshot(packet.snapshot);
      const nextFrameId = frameIdOf(snapshotTick);

      setTickBuffer((current) => {
        const baseFrameId = Math.max(initialFrameIdRef.current, current?.lastAcceptedFrameId ?? -1);
        if (nextFrameId <= baseFrameId) {
          return current;
        }

        if (!current || current.matchId !== matchId) {
          promoteSnapshotEvent(snapshotTick);
          return {
            matchId,
            active: snapshotTick,
            queue: [],
            lastAcceptedFrameId: nextFrameId,
          };
        }

        const queue = [...current.queue, snapshotTick]
          .sort(sortSnapshots)
          .slice(-MAX_TICK_QUEUE);

        return {
          ...current,
          queue,
          lastAcceptedFrameId: nextFrameId,
        };
      });
    };

    const handleEvent = (packet: MatchEventPacket) => {
      if (!sameMatch(packet?.matchId, matchId)) {
        return;
      }
      const liveEvent = eventFromPacket(packet);
      if (!liveEvent) {
        return;
      }

      const current = pendingSocketEventsRef.current;
      pendingSocketEventsRef.current = {
        matchId,
        events: pushUniqueEvent(current?.matchId === matchId ? current.events : [], liveEvent),
      };
    };

    const handleCompleted = (packet: CompletedPacket) => {
      if (!sameMatch(packet?.matchId, matchId)) {
        return;
      }
      setLiveStatus({ matchId, status: 'finished' });
      setTickBuffer((current) => {
        if (!current || current.matchId !== matchId || !current.active) {
          return current;
        }
        return {
          ...current,
          active:
            current.queue.length > 0
              ? current.active
              : {
                  ...current.active,
                  homeScore: Number(packet.homeScore ?? current.active.homeScore),
                  awayScore: Number(packet.awayScore ?? current.active.awayScore),
                  matchStep: 'full_time',
                  phase: 'full_time',
                },
        };
      });
    };

    socket.on('connect', joinMatch);
    socket.on(ESocketEvent.MATCH_SNAPSHOT, handleSnapshot);
    socket.on(ESocketEvent.MATCH_EVENT, handleEvent);
    socket.on(ESocketEvent.MATCH_COMPLETED, handleCompleted);

    if (socket.connected) {
      joinMatch();
    }

    return () => {
      socket.emit(ESocketEvent.MATCH_LEAVE, { matchId });
      socket.off('connect', joinMatch);
      socket.off(ESocketEvent.MATCH_SNAPSHOT, handleSnapshot);
      socket.off(ESocketEvent.MATCH_EVENT, handleEvent);
      socket.off(ESocketEvent.MATCH_COMPLETED, handleCompleted);
    };
  }, [matchId, promoteSnapshotEvent, socket]);

  return useMemo(
    () => ({
      snapshot,
      events,
      status,
      isConnected,
      isLoading,
      error,
      queuedTicks,
      ackActiveTick,
    }),
    [ackActiveTick, error, events, isConnected, isLoading, queuedTicks, snapshot, status],
  );
}
