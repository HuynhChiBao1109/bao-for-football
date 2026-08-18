import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ESocketEvent } from '../enums/socket';
import { normalizeSnapshot } from '../lib/normalizeMatchSnapshot';
import { useMatch } from './useMatch';
import { useSocketSession } from './useSocketSession';
import type { CampaignCompletion, MatchSnapshot, MatchState } from '../types';

const MAX_TICK_QUEUE = 80;
const MAX_EVENTS = 16;

export type LiveMatchEvent = {
  id: string;
  simulationRunId?: string;
  minute: number;
  event: number | null;
  label: string;
  actorPlayerId?: string | null;
  teamSide?: 'home' | 'away' | null;
  frameId?: number;
  tick?: number;
  createdAt: number;
};

type SnapshotPacket = {
  matchId?: number | string;
  simulationRunId?: string;
  snapshot?: Partial<MatchSnapshot> | null;
};

type MatchEventPacket = {
  matchId?: number | string;
  simulationRunId?: string;
  minute?: number;
  frameId?: number;
  tick?: number;
  highlight?: Partial<MatchSnapshot['highlight']> | null;
};

type CompletedPacket = {
  matchId?: number | string;
  simulationRunId?: string;
  homeScore?: number;
  awayScore?: number;
  campaignCompletion?: CampaignCompletion | null;
};

type TickBuffer = {
  matchId: string;
  simulationRunId: string | null;
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

function simulationRunIdOf(...sources: Array<{ simulationRunId?: unknown } | null | undefined>) {
  for (const source of sources) {
    const value = source?.simulationRunId;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function eventKey(event: LiveMatchEvent) {
  return `${event.simulationRunId ?? 'legacy'}:${event.frameId ?? 'db'}:${event.minute}:${event.event ?? 'none'}:${event.actorPlayerId ?? 'none'}:${event.label}`;
}

function eventFromSnapshot(snapshot: MatchSnapshot): LiveMatchEvent | null {
  const highlight = snapshot.highlight;
  if (!highlight?.event && !highlight?.label) {
    return null;
  }

  return {
    id: `${snapshot.simulationRunId ?? 'legacy'}-${snapshot.frameId ?? snapshot.tick}-${snapshot.minute}-${highlight.event ?? 'event'}-${highlight.actorPlayerId ?? 'none'}`,
    simulationRunId: snapshot.simulationRunId,
    minute: Number(snapshot.minute ?? 0),
    event: highlight.event ?? null,
    label: highlight.label ?? 'Match event',
    actorPlayerId: highlight.actorPlayerId ? String(highlight.actorPlayerId) : null,
    teamSide: highlight.teamSide ?? null,
    frameId: frameIdOf(snapshot),
    tick: Number(snapshot.tick ?? snapshot.frameId ?? 0),
    createdAt: frameIdOf(snapshot),
  };
}

function eventFromPacket(packet: MatchEventPacket): LiveMatchEvent | null {
  const highlight = packet.highlight;
  if (!highlight?.event && !highlight?.label) {
    return null;
  }

  return {
    id: `${packet.simulationRunId ?? 'legacy'}-${packet.minute ?? 0}-${highlight.event ?? 'event'}-${highlight.actorPlayerId ?? 'none'}`,
    simulationRunId: packet.simulationRunId,
    minute: Number(packet.minute ?? 0),
    event: highlight.event ?? null,
    label: highlight.label ?? 'Match event',
    actorPlayerId: highlight.actorPlayerId ? String(highlight.actorPlayerId) : null,
    teamSide: highlight.teamSide ?? null,
    frameId: Number(packet.frameId ?? packet.tick ?? 0),
    tick: Number(packet.tick ?? packet.frameId ?? 0),
    createdAt: Number(packet.frameId ?? packet.tick ?? packet.minute ?? 0),
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

function buildLineupSnapshot(match: MatchState | undefined): MatchSnapshot | null {
  const homePlayers = Array.isArray(match?.homeLineup) ? match.homeLineup : [];
  const awayPlayers = Array.isArray(match?.awayLineup) ? match.awayLineup : [];

  if (!homePlayers.length || !awayPlayers.length) {
    return null;
  }

  return normalizeSnapshot({
    simulationRunId: match?.simulationRunId,
    frameId: -1,
    tick: -1,
    durationMs: 0,
    matchStep: 'first_half_start',
    minute: Number(match?.currentMinute ?? 0),
    second: Number(match?.clockSeconds ?? 0),
    displaySecond: 0,
    clockLabel: '00:00',
    phase: 'first_half',
    homeScore: Number(match?.homeScore ?? 0),
    awayScore: Number(match?.awayScore ?? 0),
    possession: 'home',
    ball: {
      x: 50,
      y: 50,
      ownerPlayerId: null,
      speed: 0,
    },
    highlight: {
      event: null,
      label: '',
      teamSide: null,
      actorPlayerId: null,
      secondaryPlayerId: null,
      skill: null,
    },
    homePlayers: homePlayers as unknown as MatchSnapshot['homePlayers'],
    awayPlayers: awayPlayers as unknown as MatchSnapshot['awayPlayers'],
  });
}

export function useMatchSocket(matchId: string | undefined) {
  const { socket, isConnected } = useSocketSession();
  const { data, isLoading, error } = useMatch(matchId);
  const hydratedMatchIdRef = useRef<string | undefined>(undefined);
  const simulationRunIdRef = useRef<string | null>(null);
  const hasAuthoritativeBufferRef = useRef(false);
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
  const completedFrameIdRef = useRef(-1);
  const [liveStatus, setLiveStatus] = useState<{ matchId: string; status: string } | null>(null);
  const [campaignCompletionState, setCampaignCompletionState] = useState<{
    matchId: string;
    completion: CampaignCompletion | null;
  } | null>(null);

  const initialSnapshot = useMemo(() => {
    if (data?.latestSnapshot) {
      const normalizedSnapshot = normalizeSnapshot(data.latestSnapshot);
      const stateRunId = simulationRunIdOf(data);
      const snapshotRunId = simulationRunIdOf(normalizedSnapshot);

      if (stateRunId !== null && snapshotRunId !== stateRunId) {
        return buildLineupSnapshot(data);
      }

      return normalizedSnapshot;
    }

    return buildLineupSnapshot(data);
  }, [data]);

  const initialSimulationRunId = simulationRunIdOf(data, initialSnapshot);

  useEffect(() => {
    if (hydratedMatchIdRef.current !== matchId) {
      hydratedMatchIdRef.current = matchId;
      simulationRunIdRef.current = initialSimulationRunId;
      hasAuthoritativeBufferRef.current = false;
      initialFrameIdRef.current = frameIdOf(initialSnapshot);
      completedFrameIdRef.current = frameIdOf(initialSnapshot);
      return;
    }

    const currentRunId = simulationRunIdRef.current;
    if (currentRunId !== null && initialSimulationRunId !== currentRunId) {
      return;
    }

    if (currentRunId === null) {
      simulationRunIdRef.current = initialSimulationRunId;
    }

    if (hasAuthoritativeBufferRef.current) {
      return;
    }

    initialFrameIdRef.current = frameIdOf(initialSnapshot);
    completedFrameIdRef.current = frameIdOf(initialSnapshot);
  }, [initialSimulationRunId, initialSnapshot, matchId]);

  const acceptSimulationRun = useCallback((incomingRunId: string | null) => {
    const currentRunId = simulationRunIdRef.current;
    if (currentRunId !== null) {
      return incomingRunId === currentRunId;
    }

    if (incomingRunId !== null) {
      simulationRunIdRef.current = incomingRunId;
    }
    return true;
  }, []);

  const initialEvents = useMemo(() => [], []);

  const activeLiveSnapshot =
    tickBuffer && tickBuffer.matchId === matchId ? tickBuffer.active : null;
  const snapshot = activeLiveSnapshot ?? initialSnapshot;
  const events = liveEvents && liveEvents.matchId === matchId ? liveEvents.events : initialEvents;
  const queuedTicks = tickBuffer && tickBuffer.matchId === matchId ? tickBuffer.queue.length : 0;
  const status =
    liveStatus && liveStatus.matchId === matchId
      ? liveStatus.status
      : (data?.status ?? (isLoading ? 'loading' : 'ready'));
  const campaignCompletion =
    campaignCompletionState && campaignCompletionState.matchId === matchId
      ? campaignCompletionState.completion
      : null;

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
                event.simulationRunId === snapshotEvent?.simulationRunId &&
                event.minute === snapshotEvent?.minute &&
                event.event === snapshotEvent?.event &&
                event.actorPlayerId === snapshotEvent?.actorPlayerId,
            )
          : null;
      const eventToShow =
        snapshotEvent && matchingSocketEvent
          ? {
              ...matchingSocketEvent,
              id: snapshotEvent.id,
              frameId: snapshotEvent.frameId,
              tick: snapshotEvent.tick,
              minute: snapshotEvent.minute,
              event: snapshotEvent.event,
            }
          : snapshotEvent;

      setLiveEvents((current) => ({
        matchId,
        events: pushUniqueEvent(current?.matchId === matchId ? current.events : [], eventToShow),
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

      if (!acceptSimulationRun(simulationRunIdOf(completedSnapshot))) {
        return;
      }

      completedFrameIdRef.current = Math.max(
        completedFrameIdRef.current,
        frameIdOf(completedSnapshot),
      );

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
    [acceptSimulationRun, matchId, promoteSnapshotEvent],
  );

  const resetLiveState = useCallback(
    (match: MatchState) => {
      if (!matchId) {
        return;
      }

      const resetSnapshot = buildLineupSnapshot(match);
      const resetRunId = simulationRunIdOf(match, resetSnapshot);
      simulationRunIdRef.current = resetRunId;
      hasAuthoritativeBufferRef.current = true;
      initialFrameIdRef.current = -1;
      completedFrameIdRef.current = -1;
      pendingSocketEventsRef.current = null;
      setLiveEvents({ matchId, events: [] });
      setLiveStatus({ matchId, status: match.status ?? 'in_progress' });
      setCampaignCompletionState({ matchId, completion: null });
      setTickBuffer(
        resetSnapshot
          ? {
              matchId,
              simulationRunId: resetRunId,
              active: resetSnapshot,
              queue: [],
              lastAcceptedFrameId: -1,
            }
          : null,
      );
    },
    [matchId],
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

      const incomingRunId = simulationRunIdOf(packet, packet.snapshot);
      if (!acceptSimulationRun(incomingRunId)) {
        return;
      }
      hasAuthoritativeBufferRef.current = true;
      const snapshotTick = normalizeSnapshot(packet.snapshot);
      if (incomingRunId) {
        snapshotTick.simulationRunId = incomingRunId;
      }
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
            simulationRunId: incomingRunId,
            active: snapshotTick,
            queue: [],
            lastAcceptedFrameId: nextFrameId,
          };
        }

        const queue = [...current.queue, snapshotTick].sort(sortSnapshots).slice(-MAX_TICK_QUEUE);

        if (queue.length === 1 && frameIdOf(current.active) <= completedFrameIdRef.current) {
          promoteSnapshotEvent(snapshotTick);
          return {
            ...current,
            simulationRunId: incomingRunId,
            active: snapshotTick,
            queue: [],
            lastAcceptedFrameId: nextFrameId,
          };
        }

        return {
          ...current,
          simulationRunId: incomingRunId,
          queue,
          lastAcceptedFrameId: nextFrameId,
        };
      });
    };

    const handleEvent = (packet: MatchEventPacket) => {
      if (!sameMatch(packet?.matchId, matchId)) {
        return;
      }
      if (!acceptSimulationRun(simulationRunIdOf(packet))) {
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
      if (!acceptSimulationRun(simulationRunIdOf(packet))) {
        return;
      }
      setLiveStatus({ matchId, status: 'finished' });
      setCampaignCompletionState({
        matchId,
        completion: packet.campaignCompletion ?? null,
      });
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
  }, [acceptSimulationRun, matchId, promoteSnapshotEvent, socket]);

  return useMemo(
    () => ({
      match: data,
      snapshot,
      events,
      status,
      isConnected,
      isLoading,
      error,
      queuedTicks,
      ackActiveTick,
      resetLiveState,
      campaignCompletion,
    }),
    [
      ackActiveTick,
      data,
      error,
      events,
      isConnected,
      isLoading,
      queuedTicks,
      resetLiveState,
      snapshot,
      status,
      campaignCompletion,
    ],
  );
}
