import { useEffect, useMemo, useState } from 'react';
import { useTactics, useSaveTactics } from '../hooks/useTactics';
import { useSession } from '../hooks/useSession';
import { usePlayerCards } from '../hooks/usePlayerCards';
import { Banner } from '../components/feedback';
import { API_BASE_URL } from '../lib/apiClient';
import { MatchMode } from '../enums/match';
import type { Tactics } from '../types';
import type { UserPlayerCard } from '../types';

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
  | 'LCB'
  | 'RCB'
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

const DEFAULT_PLAYER_AVATAR = '/default-avatar.svg';

const FORMATION_SLOTS: Record<string, FieldSlot[]> = {
  '4-3-3': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'LCB', label: 'LCB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'RCB', label: 'RCB', x: 62, y: 78 },
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
    { slotId: 'lcb', role: 'LCB', label: 'LCB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'RCB', label: 'RCB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 18, y: 55 },
    { slotId: 'lcm', role: 'LCM', label: 'LCM', x: 40, y: 56 },
    { slotId: 'rcm', role: 'RCM', label: 'RCM', x: 60, y: 56 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 82, y: 55 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 42, y: 26 },
    { slotId: 'st2', role: 'ST2', label: 'ST', x: 58, y: 26 },
  ],
};

const ROLE_PROFILES: Record<Role, Array<{ key: string; weight: number }>> = {
  GK: [
    { key: 'gkReach', weight: 0.34 },
    { key: 'gkReflex', weight: 0.33 },
    { key: 'gkParrying', weight: 0.25 },
    { key: 'passing', weight: 0.08 },
  ],
  LB: [
    { key: 'defensiveAwareness', weight: 0.27 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'pace', weight: 0.25 },
    { key: 'stamina', weight: 0.12 },
    { key: 'passing', weight: 0.12 },
  ],
  LCB: [
    { key: 'defensiveAwareness', weight: 0.3 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'duels', weight: 0.2 },
    { key: 'strength', weight: 0.16 },
    { key: 'longPass', weight: 0.1 },
  ],
  RCB: [
    { key: 'defensiveAwareness', weight: 0.3 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'duels', weight: 0.2 },
    { key: 'strength', weight: 0.16 },
    { key: 'longPass', weight: 0.1 },
  ],
  RB: [
    { key: 'defensiveAwareness', weight: 0.27 },
    { key: 'standingTackle', weight: 0.24 },
    { key: 'pace', weight: 0.25 },
    { key: 'stamina', weight: 0.12 },
    { key: 'passing', weight: 0.12 },
  ],
  LM: [
    { key: 'pace', weight: 0.24 },
    { key: 'dribbling', weight: 0.2 },
    { key: 'passing', weight: 0.18 },
    { key: 'stamina', weight: 0.16 },
    { key: 'vision', weight: 0.12 },
    { key: 'curve', weight: 0.1 },
  ],
  LCM: [
    { key: 'passing', weight: 0.24 },
    { key: 'vision', weight: 0.2 },
    { key: 'stamina', weight: 0.16 },
    { key: 'duels', weight: 0.12 },
    { key: 'defensiveAwareness', weight: 0.12 },
    { key: 'shooting', weight: 0.16 },
  ],
  CM: [
    { key: 'passing', weight: 0.24 },
    { key: 'vision', weight: 0.22 },
    { key: 'stamina', weight: 0.17 },
    { key: 'duels', weight: 0.12 },
    { key: 'defensiveAwareness', weight: 0.1 },
    { key: 'shooting', weight: 0.15 },
  ],
  RCM: [
    { key: 'passing', weight: 0.24 },
    { key: 'vision', weight: 0.2 },
    { key: 'stamina', weight: 0.16 },
    { key: 'duels', weight: 0.12 },
    { key: 'defensiveAwareness', weight: 0.12 },
    { key: 'shooting', weight: 0.16 },
  ],
  RM: [
    { key: 'pace', weight: 0.24 },
    { key: 'dribbling', weight: 0.2 },
    { key: 'passing', weight: 0.18 },
    { key: 'stamina', weight: 0.16 },
    { key: 'vision', weight: 0.12 },
    { key: 'curve', weight: 0.1 },
  ],
  LW: [
    { key: 'pace', weight: 0.25 },
    { key: 'dribbling', weight: 0.24 },
    { key: 'shooting', weight: 0.2 },
    { key: 'attackingAwareness', weight: 0.15 },
    { key: 'curve', weight: 0.08 },
    { key: 'passing', weight: 0.08 },
  ],
  RW: [
    { key: 'pace', weight: 0.25 },
    { key: 'dribbling', weight: 0.24 },
    { key: 'shooting', weight: 0.2 },
    { key: 'attackingAwareness', weight: 0.15 },
    { key: 'curve', weight: 0.08 },
    { key: 'passing', weight: 0.08 },
  ],
  ST: [
    { key: 'shooting', weight: 0.34 },
    { key: 'attackingAwareness', weight: 0.2 },
    { key: 'pace', weight: 0.18 },
    { key: 'dribbling', weight: 0.12 },
    { key: 'technique', weight: 0.08 },
    { key: 'strength', weight: 0.08 },
  ],
  ST2: [
    { key: 'shooting', weight: 0.34 },
    { key: 'attackingAwareness', weight: 0.2 },
    { key: 'pace', weight: 0.18 },
    { key: 'dribbling', weight: 0.12 },
    { key: 'technique', weight: 0.08 },
    { key: 'strength', weight: 0.08 },
  ],
};

const PRIMARY_ROLE_POOL: Role[] = [
  'GK',
  'LB',
  'LCB',
  'RCB',
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
    case 'LCB':
    case 'RCB':
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

function statOf(card: UserPlayerCard, key: string): number {
  const pool = card.totalStats as Record<string, number>;
  return Number(pool[key] ?? 0);
}

function roleScore(card: UserPlayerCard, role: Role): number {
  const profile = ROLE_PROFILES[role];
  const weighted = profile.reduce((sum, item) => sum + statOf(card, item.key) * item.weight, 0);
  return Number(weighted.toFixed(2));
}

function inferPrimaryRole(card: UserPlayerCard): Role {
  let bestRole: Role = 'ST';
  let best = -1;
  for (const role of PRIMARY_ROLE_POOL) {
    const current = roleScore(card, role);
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

export function TacticsPage() {
  const { data: sessionData } = useSession();
  const tacticsTeamId = sessionData?.team?.id
    ? `team-${sessionData.team.id}`
    : sessionData?.user?.id
      ? `user-${sessionData.user.id}`
      : '';

  const { data: loaded, isLoading, error: loadError } = useTactics(tacticsTeamId || undefined);
  const { data: cards = [], isLoading: isCardsLoading, error: cardError } = usePlayerCards();
  const saveMutation = useSaveTactics();

  const [form, setForm] = useState<Tactics>(DEFAULT_TACTICS);
  const [message, setMessage] = useState('');
  const [lineup, setLineup] = useState<Record<string, number | null>>({});
  const [dragOverSlot, setDragOverSlot] = useState<string>('');

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
        score: card ? Math.round(roleScore(card, slot.role) * effect) : 0,
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
          overall: Math.round(roleScore(card, primary) * effect),
        };
      })
      .sort((a, b) => b.overall - a.overall);
  }, [cards, usedStarterIds]);

  const lineupPayload = useMemo(
    () =>
      formationSlots
        .map((slot) => ({
          slotId: slot.slotId,
          position: roleToPosition(slot.role),
          userPlayerId: Number(lineup[slot.slotId] || 0),
        }))
        .filter((item) => item.userPlayerId > 0),
    [formationSlots, lineup],
  );

  const starterOverall = useMemo(
    () => starters.reduce((sum, slot) => sum + slot.score, 0),
    [starters],
  );
  const starterCount = useMemo(() => starters.filter((s) => Boolean(s.card)).length, [starters]);
  const starterAverage = useMemo(
    () => (starterCount ? starterOverall / starterCount : 0),
    [starterCount, starterOverall],
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
          roleScore(available[i], slot.role) *
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
    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Tactics Forge</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">
            Bảng điều khiển lối chơi đội bóng
          </h2>
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
                disabled={saveMutation.isPending || !tacticsTeamId}
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
                  Overall Sum: <strong className="text-emerald-300">{starterOverall}</strong>
                </span>
                <span className="text-slate-200">
                  Overall Avg: <strong className="text-white">{starterAverage.toFixed(1)}</strong>
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
                      <p className="text-[11px] text-emerald-200/80">OVR {slot.score || '--'}</p>
                      <p className="text-[10px] text-amber-200/85">
                        Effect x{slot.effect ? slot.effect.toFixed(2) : '--'}
                      </p>
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
                  {benchPlayers.map(({ card, primary, effect, overall }) => (
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
                          {primary} · Effect x{effect.toFixed(2)} · OVR {overall}
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
