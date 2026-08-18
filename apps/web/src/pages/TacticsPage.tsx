import { startTransition, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTactics, useSaveTactics } from '../hooks/useTactics';
import { useSession } from '../hooks/useSession';
import { usePlayerCards } from '../hooks/usePlayerCards';
import { Banner } from '../components/feedback';
import { API_BASE_URL } from '../lib/apiClient';
import { DEFAULT_PLAYER_AVATAR } from '../lib/referenceImage';
import { lineupPositionScore } from '../lib/lineupRating';
import { MatchMode } from '../enums/match';
import type { Tactics } from '../types';
import type { UserPlayerCard } from '../types';
import { useStartCampaignMatch } from '../hooks/useMatch';
import { matchLivePath } from '../routes';
import { PlayerDetailPopup } from './PlayerDetailPage';

const DEFAULT_TACTICS: Tactics = {
  formation: '4-3-3',
  passRatio: 58,
  shotRatio: 42,
  pressure: 61,
  mode: MatchMode.Casual,
  gameplay: {
    passSpeedScale: 1.05,
    interceptionRadius: 1.02,
    gkBuildUpBias: 1,
    tempoScale: 1.05,
  },
};

type Role =
  | 'GK'
  | 'LB'
  | 'CB'
  | 'RB'
  | 'LM'
  | 'LCM'
  | 'CM'
  | 'RCM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST'
  | 'ST2';

type FieldSlot = {
  slotId: string;
  role: Role;
  label: string;
  x: number;
  y: number;
};

type DragPayload = {
  playerId: number;
  fromSlotId?: string;
};

const FORMATION_SLOTS: Record<string, FieldSlot[]> = {
  '4-3-3': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lcm', role: 'LCM', label: 'LCM', x: 30, y: 57 },
    { slotId: 'cm', role: 'CM', label: 'CM', x: 50, y: 55 },
    { slotId: 'rcm', role: 'RCM', label: 'RCM', x: 70, y: 57 },
    { slotId: 'lw', role: 'LW', label: 'LW', x: 20, y: 30 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 24 },
    { slotId: 'rw', role: 'RW', label: 'RW', x: 80, y: 30 },
  ],
  '4-4-2': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 18, y: 55 },
    { slotId: 'lcm', role: 'LCM', label: 'LCM', x: 40, y: 56 },
    { slotId: 'rcm', role: 'RCM', label: 'RCM', x: 60, y: 56 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 82, y: 55 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 42, y: 26 },
    { slotId: 'st2', role: 'ST2', label: 'ST', x: 58, y: 26 },
  ],
  '3-5-2': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 28, y: 78 },
    { slotId: 'cb', role: 'CB', label: 'CB', x: 50, y: 80 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 72, y: 78 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 14, y: 56 },
    { slotId: 'lcm', role: 'LCM', label: 'CM', x: 34, y: 58 },
    { slotId: 'cm', role: 'CM', label: 'CM', x: 50, y: 53 },
    { slotId: 'rcm', role: 'RCM', label: 'CM', x: 66, y: 58 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 86, y: 56 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 42, y: 24 },
    { slotId: 'st2', role: 'ST2', label: 'ST', x: 58, y: 24 },
  ],
  '3-4-3': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 28, y: 78 },
    { slotId: 'cb', role: 'CB', label: 'CB', x: 50, y: 80 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 72, y: 78 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 17, y: 56 },
    { slotId: 'lcm', role: 'LCM', label: 'CM', x: 40, y: 58 },
    { slotId: 'rcm', role: 'RCM', label: 'CM', x: 60, y: 58 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 83, y: 56 },
    { slotId: 'lw', role: 'LW', label: 'LW', x: 20, y: 28 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 22 },
    { slotId: 'rw', role: 'RW', label: 'RW', x: 80, y: 28 },
  ],
  '4-5-1': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 15, y: 48 },
    { slotId: 'lcm', role: 'LCM', label: 'CM', x: 33, y: 57 },
    { slotId: 'cm', role: 'CM', label: 'CM', x: 50, y: 53 },
    { slotId: 'rcm', role: 'RCM', label: 'CM', x: 67, y: 57 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 85, y: 48 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 23 },
  ],
  '5-4-1': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 10, y: 69 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 30, y: 79 },
    { slotId: 'cb', role: 'CB', label: 'CB', x: 50, y: 81 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 70, y: 79 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 90, y: 69 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 17, y: 50 },
    { slotId: 'lcm', role: 'LCM', label: 'CM', x: 40, y: 57 },
    { slotId: 'rcm', role: 'RCM', label: 'CM', x: 60, y: 57 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 83, y: 50 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 22 },
  ],
};

const PRIMARY_ROLE_POOL: Role[] = [
  'GK',
  'LB',
  'CB',
  'RB',
  'LM',
  'LCM',
  'CM',
  'RCM',
  'RM',
  'LW',
  'RW',
  'ST',
];

function roleToPosition(role: Role): string {
  switch (role) {
    case 'CB':
      return 'CB';
    case 'LM':
      return 'LMF';
    case 'RM':
      return 'RMF';
    case 'LCM':
    case 'RCM':
    case 'CM':
      return 'CM';
    case 'ST':
    case 'ST2':
      return 'CF';
    default:
      return role;
  }
}

function positionEffect(card: UserPlayerCard, position: string): number {
  const normalized = position.toUpperCase();
  const found = card.positions?.find(
    (item) => String(item.position || '').toUpperCase() === normalized,
  );
  if (!found) return 0.5;
  const value = Number(found.effect ?? 0);
  if (value <= 0) return 0.5;
  if (value > 1) return 1;
  return value;
}

function resolveMediaUrl(value: string | undefined | null): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
}

function resolvePlayerAvatarUrl(card: UserPlayerCard | null | undefined): string {
  if (!card) return DEFAULT_PLAYER_AVATAR;
  const value = resolveMediaUrl(card.imageUrl || card.avatarUrl);
  return value || DEFAULT_PLAYER_AVATAR;
}

function inferPrimaryRole(card: UserPlayerCard): Role {
  let bestRole: Role = 'ST';
  let best = -1;
  for (const role of PRIMARY_ROLE_POOL) {
    const current = lineupPositionScore(card, role);
    if (current > best) {
      best = current;
      bestRole = role;
    }
  }
  return bestRole;
}

function shortName(value: string): string {
  const clean = value.trim();
  if (!clean) return 'Unknown';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0].slice(0, 1)}. ${parts[parts.length - 1]}`;
}

function normalizeFieldCoordinate(value: unknown, fallback: number): number {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) return fallback;
  return Math.max(5, Math.min(95, coordinate));
}

type TacticsEditorProps = {
  pendingCampaignMatchIdOverride?: string;
  isPopup?: boolean;
  onClose?: () => void;
};

export function TacticsPopup({
  campaignMatchId,
  onClose,
}: {
  campaignMatchId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: sessionData } = useSession();
  const tacticsTeamId = sessionData?.team?.id ? `team-${sessionData.team.id}` : undefined;
  const { data: loaded, isLoading, error } = useTactics(tacticsTeamId);
  const { data: cards = [] } = usePlayerCards();
  const startCampaignMatch = useStartCampaignMatch();
  const [detailPlayerId, setDetailPlayerId] = useState<number | null>(null);

  const formation = loaded?.formation || '4-3-3';
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
  const renderedSlots = useMemo(() => {
    const savedBySlot = new Map(loaded?.lineup?.map((item) => [item.slotId, item]) ?? []);
    return slots.map((slot) => {
      const saved = savedBySlot.get(slot.slotId);
      return {
        ...slot,
        label: saved?.position || slot.label,
        x: normalizeFieldCoordinate(saved?.x, slot.x),
        y: normalizeFieldCoordinate(saved?.y, slot.y),
      };
    });
  }, [loaded, slots]);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.userPlayerId, card])), [cards]);
  const lineupBySlot = useMemo(() => {
    const next: Record<string, number> = {};
    loaded?.lineup?.forEach((item) => {
      if (item.slotId && Number(item.userPlayerId) > 0) {
        next[item.slotId] = Number(item.userPlayerId);
      }
    });
    return next;
  }, [loaded]);
  const starterCount = slots.filter((slot) => Boolean(lineupBySlot[slot.slotId])).length;

  async function startMatch() {
    const response = await startCampaignMatch.mutateAsync({ campainMatchId: campaignMatchId });
    navigate(matchLivePath(response.matchId), {
      state: { backgroundLocation: location },
    });
    onClose();
  }

  return (
    <div className="game-modal-backdrop tactics-popup-backdrop" role="dialog" aria-modal="true">
      <div className="tactics-popup-card game-scroll">
        <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
          <div className="game-panel__content">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="game-header-kicker">Match Lineup</p>
                <h2 className="game-title mt-3 text-3xl font-bold text-white">Saved Lineup</h2>
                <p className="game-copy mt-2">
                  Review the current saved lineup before starting the match.
                </p>
              </div>
              <button type="button" className="game-button-ghost px-3 py-2" onClick={onClose}>
                Close
              </button>
            </div>

            {isLoading ? <Banner text="Loading saved lineup..." tone="info" /> : null}
            {error ? <Banner text={(error as Error).message} tone="error" /> : null}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="game-chip">
                Formation <strong>{formation}</strong>
              </span>
              <span className="game-chip">
                Starters <strong>{starterCount}/11</strong>
              </span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="relative overflow-hidden rounded-[8px] border border-red-400/30 bg-[radial-gradient(circle_at_50%_20%,rgba(255,46,74,0.18),transparent_42%),linear-gradient(180deg,#123c28_0%,#0b2f20_42%,#071b14_100%)] p-4">
                <div className="pointer-events-none absolute inset-4 rounded-[18px] border border-white/18" />
                <div className="pointer-events-none absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-white/20" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
                <div className="relative h-[640px] sm:h-[720px]">
                  {renderedSlots.map((slot) => {
                    const card = lineupBySlot[slot.slotId]
                      ? cardsById.get(lineupBySlot[slot.slotId])
                      : null;
                    return (
                      <div
                        key={slot.slotId}
                        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl p-1 text-center"
                        style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                        title={card ? `${card.name} - ${slot.label}` : `${slot.label} - Empty`}
                      >
                        <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-black/30 shadow-[0_0_20px_rgba(0,0,0,0.35)]">
                          <img
                            src={resolvePlayerAvatarUrl(card)}
                            alt={card?.name || slot.label}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase text-red-100">
                          {slot.label}
                        </p>
                        <p className="max-w-[96px] truncate text-xs font-semibold text-white">
                          {card ? shortName(card.name) : 'Empty'}
                        </p>
                        {card ? (
                          <button
                            type="button"
                            className="mt-1 rounded-full border border-red-300/25 bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase text-white transition hover:border-red-300/70 hover:bg-red-500/20"
                            onClick={() => setDetailPlayerId(card.userPlayerId)}
                          >
                            Detail
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="game-stat-card">
                <p className="game-stat-card__label">Match Ready</p>
                <p className="game-stat-card__value">{starterCount}/11</p>
                <p className="game-stat-card__hint">
                  Match will use these saved players in their saved slots.
                </p>
                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-wider text-white">
                      Starting XI
                    </p>
                    <span className="text-[10px] font-bold uppercase text-red-200">
                      Position / Player
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    {renderedSlots.map((slot, index) => {
                      const card = lineupBySlot[slot.slotId]
                        ? cardsById.get(lineupBySlot[slot.slotId])
                        : null;
                      return (
                        <button
                          key={`summary-${slot.slotId}`}
                          type="button"
                          className="group grid min-h-9 grid-cols-[24px_42px_minmax(0,1fr)] items-center gap-2 border-b border-white/8 px-1 py-1 text-left last:border-b-0 disabled:cursor-default"
                          disabled={!card}
                          onClick={() => card && setDetailPlayerId(card.userPlayerId)}
                        >
                          <span className="text-[10px] font-bold text-slate-500">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="inline-flex h-6 items-center justify-center rounded-[4px] border border-red-400/35 bg-red-500/12 px-1 text-[10px] font-black uppercase text-red-100">
                            {slot.label}
                          </span>
                          <span className="truncate text-xs font-bold text-white transition group-hover:text-red-200">
                            {card?.name || 'Empty slot'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="game-button-primary mt-5 w-full"
                  disabled={startCampaignMatch.isPending || starterCount < 11}
                  onClick={() => void startMatch()}
                >
                  {startCampaignMatch.isPending ? 'Starting...' : 'Start Match'}
                </button>
                {starterCount < 11 ? (
                  <p className="mt-3 text-sm text-amber-200">
                    Save a full lineup before starting this match.
                  </p>
                ) : null}
                {startCampaignMatch.error ? (
                  <Banner text={(startCampaignMatch.error as Error).message} tone="error" />
                ) : null}
              </div>
            </div>
          </div>
        </article>
        {detailPlayerId ? (
          <PlayerDetailPopup
            userPlayerId={detailPlayerId}
            onClose={() => setDetailPlayerId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}

export function TacticsPage({
  pendingCampaignMatchIdOverride,
  isPopup = false,
  onClose,
}: TacticsEditorProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pendingCampaignMatchId =
    pendingCampaignMatchIdOverride || searchParams.get('startCampaignMatchId') || '';
  const { data: sessionData } = useSession();
  const tacticsTeamId = sessionData?.team?.id
    ? `team-${sessionData.team.id}`
    : sessionData?.user?.id
      ? `user-${sessionData.user.id}`
      : '';

  const { data: loaded, isLoading, error: loadError } = useTactics(tacticsTeamId || undefined);
  const { data: cards = [], isLoading: isCardsLoading, error: cardError } = usePlayerCards();
  const saveMutation = useSaveTactics();
  const startCampaignMatch = useStartCampaignMatch();

  const [form, setForm] = useState<Tactics>(DEFAULT_TACTICS);
  const [message, setMessage] = useState('');
  const [lineup, setLineup] = useState<Record<string, number | null>>({});
  const [dragOverSlot, setDragOverSlot] = useState<string>('');
  const [detailPlayerId, setDetailPlayerId] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded) return;
    setForm(loaded);
    if (Array.isArray(loaded.lineup)) {
      const next: Record<string, number | null> = {};
      loaded.lineup.forEach((item) => {
        if (item?.slotId && Number(item.userPlayerId || 0) > 0) {
          next[item.slotId] = Number(item.userPlayerId);
        }
      });
      setLineup(next);
    }
  }, [loaded]);

  const formationSlots = useMemo(
    () => FORMATION_SLOTS[form.formation] ?? FORMATION_SLOTS['4-3-3'],
    [form.formation],
  );

  useEffect(() => {
    setLineup((prev) => {
      const next: Record<string, number | null> = {};
      for (const slot of formationSlots) {
        next[slot.slotId] = prev[slot.slotId] ?? null;
      }
      return next;
    });
  }, [formationSlots]);

  const total = useMemo(() => form.passRatio + form.shotRatio + form.pressure, [form]);

  const cardsById = useMemo(() => {
    const map = new Map<number, UserPlayerCard>();
    cards.forEach((card) => map.set(card.userPlayerId, card));
    return map;
  }, [cards]);

  const starters = useMemo(() => {
    return formationSlots.map((slot) => {
      const playerId = lineup[slot.slotId];
      const card = playerId ? (cardsById.get(playerId) ?? null) : null;
      const targetPosition = roleToPosition(slot.role);
      const effect = card ? positionEffect(card, targetPosition) : 0;
      return {
        ...slot,
        playerId,
        card,
        targetPosition,
        effect,
        score: card ? Math.round(lineupPositionScore(card, slot.role) * effect) : 0,
      };
    });
  }, [formationSlots, lineup, cardsById]);

  const usedStarterIds = useMemo(
    () => new Set(starters.map((s) => s.playerId).filter(Boolean) as number[]),
    [starters],
  );

  const benchPlayers = useMemo(() => {
    return cards
      .filter((card) => !usedStarterIds.has(card.userPlayerId))
      .map((card) => {
        const primary = inferPrimaryRole(card);
        const bestPosition = roleToPosition(primary);
        const effect = positionEffect(card, bestPosition);
        return {
          card,
          primary,
          effect,
          rating: Math.round(lineupPositionScore(card, primary) * effect),
        };
      })
      .sort((a, b) => b.rating - a.rating);
  }, [cards, usedStarterIds]);

  const lineupPayload = useMemo(
    () =>
      formationSlots
        .map((slot) => ({
          slotId: slot.slotId,
          position: roleToPosition(slot.role),
          userPlayerId: Number(lineup[slot.slotId] || 0),
          x: slot.x,
          y: slot.y,
        }))
        .filter((item) => item.userPlayerId > 0),
    [formationSlots, lineup],
  );

  const starterRatingTotal = useMemo(
    () => starters.reduce((sum, slot) => sum + slot.score, 0),
    [starters],
  );
  const starterCount = useMemo(() => starters.filter((s) => Boolean(s.card)).length, [starters]);
  const starterRatingAverage = useMemo(
    () => (starterCount ? starterRatingTotal / starterCount : 0),
    [starterCount, starterRatingTotal],
  );

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const result = await saveMutation.mutateAsync({
        teamId: tacticsTeamId,
        ...form,
        lineup: lineupPayload,
      });
      setForm(result);
      if (pendingCampaignMatchId) {
        setMessage('Saved tactics. Starting match...');
        const response = await startCampaignMatch.mutateAsync({
          campainMatchId: pendingCampaignMatchId,
        });
        startTransition(() => {
          navigate(matchLivePath(response.matchId), {
            state: { backgroundLocation: location },
          });
        });
        onClose?.();
        return;
      }
      setMessage('Đã lưu chiến thuật thành công và đẩy sang realtime match engine.');
    } catch {
      /* handled below */
    }
  }

  async function saveLineupOnly() {
    setMessage('');
    try {
      await saveMutation.mutateAsync({ teamId: tacticsTeamId, ...form, lineup: lineupPayload });
      setMessage('Đã lưu lineup thành công. Reload vẫn giữ nguyên đội hình.');
    } catch {
      /* handled below */
    }
  }

  function handleAutoFormat() {
    if (cards.length === 0) return;
    const available = [...cards];
    const next: Record<string, number | null> = {};

    for (const slot of formationSlots) {
      let bestIndex = -1;
      let bestScore = -1;
      for (let i = 0; i < available.length; i += 1) {
        const score =
          lineupPositionScore(available[i], slot.role) *
          positionEffect(available[i], roleToPosition(slot.role));
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        const picked = available.splice(bestIndex, 1)[0];
        next[slot.slotId] = picked.userPlayerId;
      } else {
        next[slot.slotId] = null;
      }
    }

    setLineup(next);
  }

  function onDragStart(event: React.DragEvent, payload: DragPayload) {
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
  }

  function parseDragPayload(event: React.DragEvent): DragPayload | null {
    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DragPayload;
      if (!parsed?.playerId || Number(parsed.playerId) <= 0) return null;
      return { playerId: Number(parsed.playerId), fromSlotId: parsed.fromSlotId };
    } catch {
      return null;
    }
  }

  function onDropToSlot(event: React.DragEvent, targetSlotId: string) {
    event.preventDefault();
    setDragOverSlot('');
    const payload = parseDragPayload(event);
    if (!payload) return;

    setLineup((prev) => {
      const next = { ...prev };
      const currentTarget = next[targetSlotId] ?? null;

      if (payload.fromSlotId) {
        next[payload.fromSlotId] = currentTarget;
      } else {
        Object.keys(next).forEach((slotId) => {
          if (next[slotId] === payload.playerId) next[slotId] = null;
        });
      }

      next[targetSlotId] = payload.playerId;
      return next;
    });
  }

  function onDropBench(event: React.DragEvent) {
    event.preventDefault();
    const payload = parseDragPayload(event);
    if (!payload?.fromSlotId) return;
    setLineup((prev) => ({ ...prev, [payload.fromSlotId as string]: null }));
  }

  return (
    <section className={isPopup ? 'grid gap-6' : 'grid gap-6 lg:grid-cols-[1.2fr_0.8fr]'}>
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="game-header-kicker">Tactics Forge</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">
                Bảng điều khiển lối chơi đội bóng
              </h2>
            </div>
            {isPopup && (
              <button type="button" className="game-button-ghost px-3 py-2" onClick={onClose}>
                Close
              </button>
            )}
          </div>
          <p className="game-copy mt-3 max-w-2xl text-base">
            Chỉnh logic triển khai bóng, áp lực và gameplay modifiers, sau đó lưu thẳng sang service
            realtime.
          </p>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Tactics Team ID:{' '}
            <span className="font-semibold text-emerald-300">{tacticsTeamId || 'N/A'}</span>
            {sessionData?.team?.teamName ? ` · CLB: ${sessionData.team.teamName}` : ''}
          </p>

          {isLoading && <Banner text="Đang tải config chiến thuật từ server..." tone="info" />}
          {loadError && <Banner text={(loadError as Error).message} tone="error" />}
          {isCardsLoading && (
            <Banner text="Đang tải danh sách cầu thủ để render đội hình sân bóng..." tone="info" />
          )}
          {cardError && <Banner text={(cardError as Error).message} tone="error" />}
          {message && <Banner text={message} tone="success" />}
          {saveMutation.error && (
            <Banner text={(saveMutation.error as Error).message} tone="error" />
          )}
          {startCampaignMatch.error && (
            <Banner text={(startCampaignMatch.error as Error).message} tone="error" />
          )}
          {pendingCampaignMatchId && (
            <Banner
              text="Save this tactics setup to start the selected campaign match."
              tone="info"
            />
          )}

          {!isLoading && (
            <form className="mt-5 space-y-4" onSubmit={submitForm}>
              <FormSelect
                label="Formation"
                value={form.formation}
                options={['4-3-3', '4-4-2']}
                onChange={(v) => setForm((p) => ({ ...p, formation: v }))}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <SliderField
                  label="Pass Ratio"
                  value={form.passRatio}
                  onChange={(v) => setForm((p) => ({ ...p, passRatio: v }))}
                />
                <SliderField
                  label="Shot Ratio"
                  value={form.shotRatio}
                  onChange={(v) => setForm((p) => ({ ...p, shotRatio: v }))}
                />
                <SliderField
                  label="Pressure"
                  value={form.pressure}
                  onChange={(v) => setForm((p) => ({ ...p, pressure: v }))}
                />
              </div>

              <div className="text-xs text-slate-400">
                Tổng 3 slider:{' '}
                <span className={total > 200 ? 'text-red-400' : 'text-emerald-300'}>{total}</span>
              </div>

              <div className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <FormSelect
                  label="Match Mode Profile"
                  value={form.mode}
                  options={['ranked', 'casual', 'ai_campaign']}
                  onChange={(v) => setForm((p) => ({ ...p, mode: v }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ScaledSlider
                    label="Pass Speed Scale"
                    value={form.gameplay.passSpeedScale}
                    min={0.65}
                    max={1.45}
                    step={0.01}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, gameplay: { ...p.gameplay, passSpeedScale: v } }))
                    }
                  />
                  <ScaledSlider
                    label="Interception Radius"
                    value={form.gameplay.interceptionRadius}
                    min={0.55}
                    max={1.6}
                    step={0.01}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, gameplay: { ...p.gameplay, interceptionRadius: v } }))
                    }
                  />
                  <ScaledSlider
                    label="GK Build-up Bias"
                    value={form.gameplay.gkBuildUpBias}
                    min={0.5}
                    max={2.0}
                    step={0.01}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, gameplay: { ...p.gameplay, gkBuildUpBias: v } }))
                    }
                  />
                  <ScaledSlider
                    label="Tempo Scale"
                    value={form.gameplay.tempoScale}
                    min={0.6}
                    max={1.6}
                    step={0.01}
                    onChange={(v) =>
                      setForm((p) => ({ ...p, gameplay: { ...p.gameplay, tempoScale: v } }))
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saveMutation.isPending || startCampaignMatch.isPending || !tacticsTeamId}
                className="game-button-primary w-full"
              >
                {saveMutation.isPending ? 'Đang lưu...' : 'Lưu Chiến Thuật'}
              </button>
            </form>
          )}

          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-white">Sân bóng đội hình chính</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFormat}
                  disabled={cards.length === 0}
                  className="game-button-secondary"
                >
                  Auto Format
                </button>
                <button
                  type="button"
                  onClick={saveLineupOnly}
                  disabled={saveMutation.isPending || !tacticsTeamId}
                  className="game-button-secondary"
                >
                  Lưu Lineup
                </button>
              </div>
            </div>

            <div className="rounded-[14px] border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <span className="text-slate-200">
                  Đội hình chính:{' '}
                  <strong className="text-white">
                    {starterCount}/{formationSlots.length}
                  </strong>
                </span>
                <span className="text-slate-200">
                  Position Rating:{' '}
                  <strong className="text-emerald-300">{starterRatingTotal}</strong>
                </span>
                <span className="text-slate-200">
                  Average:{' '}
                  <strong className="text-white">{starterRatingAverage.toFixed(1)}</strong>
                </span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
              <div className="relative overflow-hidden rounded-[22px] border border-emerald-300/25 bg-[radial-gradient(circle_at_50%_20%,rgba(52,211,153,0.18),transparent_42%),linear-gradient(180deg,#0f522f_0%,#0b3c23_40%,#072f1c_100%)] p-4">
                <div className="pointer-events-none absolute inset-4 rounded-[18px] border border-white/18" />
                <div className="pointer-events-none absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-white/20" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

                <div className="relative h-[680px] sm:h-[760px]">
                  {starters.map((slot) => (
                    <div
                      key={slot.slotId}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 text-center rounded-xl p-1 transition ${dragOverSlot === slot.slotId ? 'bg-white/10 ring-2 ring-emerald-300/70' : ''}`}
                      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverSlot(slot.slotId);
                      }}
                      onDragLeave={() =>
                        setDragOverSlot((prev) => (prev === slot.slotId ? '' : prev))
                      }
                      onDrop={(event) => onDropToSlot(event, slot.slotId)}
                    >
                      <div
                        className="mx-auto flex h-14 w-14 cursor-grab items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-black/30 shadow-[0_0_20px_rgba(0,0,0,0.35)] active:cursor-grabbing"
                        draggable={Boolean(slot.playerId)}
                        onDragStart={(event) =>
                          slot.playerId &&
                          onDragStart(event, { playerId: slot.playerId, fromSlotId: slot.slotId })
                        }
                      >
                        <img
                          src={resolvePlayerAvatarUrl(slot.card)}
                          alt={slot.card?.name || slot.label}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                        {slot.label}
                      </p>
                      <p className="max-w-[90px] truncate text-xs font-semibold text-white">
                        {slot.card ? shortName(slot.card.name) : 'Trống'}
                      </p>
                      <p className="text-[11px] text-emerald-200/80">POS {slot.score || '--'}</p>
                      <p className="text-[10px] text-amber-200/85">
                        Effect x{slot.effect ? slot.effect.toFixed(2) : '--'}
                      </p>
                      {slot.card && (
                        <button
                          type="button"
                          className="mt-1 rounded-full border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition hover:border-emerald-300/70 hover:bg-emerald-400/20"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (slot.card) {
                              setDetailPlayerId(slot.card.userPlayerId);
                            }
                          }}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          Detail
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="game-stat-card"
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDropBench}
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="game-stat-card__label">Dự bị</p>
                  <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-slate-200">
                    {benchPlayers.length} cầu thủ
                  </span>
                </div>
                <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
                  {benchPlayers.length === 0 && (
                    <p className="text-sm text-slate-400">Không còn cầu thủ dự bị.</p>
                  )}
                  {benchPlayers.map(({ card, primary, effect, rating }) => (
                    <div
                      key={card.userPlayerId}
                      className="flex cursor-grab items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-2.5 active:cursor-grabbing"
                      draggable
                      onDragStart={(event) => onDragStart(event, { playerId: card.userPlayerId })}
                    >
                      <img
                        src={resolvePlayerAvatarUrl(card)}
                        alt={card.name}
                        className="h-10 w-10 rounded-full border border-white/20 bg-white/10 object-cover"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{card.name}</p>
                        <p className="text-xs text-slate-400">
                          {primary} · Effect x{effect.toFixed(2)} · POS {rating}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
      {detailPlayerId ? (
        <PlayerDetailPopup userPlayerId={detailPlayerId} onClose={() => setDetailPlayerId(null)} />
      ) : null}
    </section>
  );
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="game-input">
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function SliderField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="game-field-label">
        {label}: <strong className="text-white">{value}%</strong>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="game-range w-full"
      />
    </label>
  );
}

function ScaledSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="game-field-label">
        {label}: <strong className="text-white">{value.toFixed(2)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="game-range w-full"
      />
    </label>
  );
}
