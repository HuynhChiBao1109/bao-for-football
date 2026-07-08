import { useMemo, useState } from 'react';
import { usePlayerCards, useAllocateStats } from '../hooks/usePlayerCards';
import { STAT_FIELDS, STAT_KEYS, DEFAULT_STATS, type StatKey } from '../lib/constants';
import { API_BASE_URL } from '../lib/apiClient';
import { resolveClubImage, resolveCountryImage } from '../lib/referenceImage';
import { Banner } from '../components/feedback';
import type { UserPlayerCard } from '../types';
import { PlayerDetailPopup } from './PlayerDetailPage';

const DEFAULT_PLAYER_AVATAR = '/default-avatar.svg';

function resolveMediaUrl(value: string | undefined | null): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
}

function resolvePlayerAvatarUrl(card: UserPlayerCard): string {
  const value = resolveMediaUrl(card.imageUrl || card.avatarUrl);
  return value || DEFAULT_PLAYER_AVATAR;
}

function buildTargetStats(card: UserPlayerCard | null): Record<StatKey, number> {
  if (!card?.totalStats) return { ...DEFAULT_STATS };
  return STAT_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: Number(card.totalStats[key] ?? 0) }),
    {} as Record<StatKey, number>,
  );
}

function buildDelta(card: UserPlayerCard, target: Record<StatKey, number>) {
  return STAT_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: Number(target[key] ?? 0) - Number(card.totalStats[key] ?? 0) }),
    {} as Record<StatKey, number>,
  );
}

export function PlayersPage() {
  const { data: cards = [], isLoading, error, refetch } = usePlayerCards();
  const allocateMutation = useAllocateStats();

  const [selectedId, setSelectedId] = useState<number>(0);
  const [allocate, setAllocate] = useState<Record<StatKey, number>>(DEFAULT_STATS);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<number | null>(null);

  const selectedCard = useMemo(() => {
    if (cards.length === 0) return null;
    return cards.find((c) => c.userPlayerId === selectedId) ?? cards[0];
  }, [cards, selectedId]);

  const delta = useMemo(() => {
    if (!selectedCard) return DEFAULT_STATS;
    return buildDelta(selectedCard, allocate);
  }, [selectedCard, allocate]);

  const spendPoints = useMemo(
    () => STAT_KEYS.reduce((sum, key) => sum + Number(delta[key] ?? 0), 0),
    [delta],
  );

  const projectedPoints = useMemo(() => {
    if (!selectedCard) return 0;
    return Number(selectedCard.currentPoints ?? 0) - spendPoints;
  }, [selectedCard, spendPoints]);

  const hasNegativeBonus = useMemo(() => {
    if (!selectedCard) return false;
    return STAT_KEYS.some(
      (key) => Number(selectedCard.bonusStats[key] ?? 0) + Number(delta[key] ?? 0) < 0,
    );
  }, [selectedCard, delta]);

  const canSubmit = selectedCard && spendPoints !== 0 && !hasNegativeBonus && projectedPoints >= 0;

  function onSelectCard(id: number) {
    setSelectedId(id);
    const card = cards.find((c) => c.userPlayerId === id);
    if (card) setAllocate(buildTargetStats(card));
    setFeedback(null);
  }

  function clampValue(key: StatKey, next: number): number {
    if (!selectedCard) return Math.trunc(next);
    const intVal = Math.trunc(Number(next) || 0);
    const deltaWithoutKey = STAT_KEYS.reduce((sum, k) => {
      if (k === key) return sum;
      return sum + (Number(allocate[k] ?? 0) - Number(selectedCard.totalStats[k] ?? 0));
    }, 0);
    const minVal = Number(selectedCard.baseStats[key] ?? 0);
    const maxVal =
      Number(selectedCard.totalStats[key] ?? 0) +
      Number(selectedCard.currentPoints ?? 0) -
      deltaWithoutKey;
    return Math.min(maxVal, Math.max(minVal, intVal));
  }

  function updateStat(key: StatKey, value: number) {
    setAllocate((prev) => ({ ...prev, [key]: clampValue(key, value) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard || !canSubmit) return;
    setFeedback(null);
    try {
      await allocateMutation.mutateAsync({
        playerId: selectedCard.userPlayerId,
        delta: delta as Record<StatKey, number>,
      });
      setFeedback({
        type: 'ok',
        text:
          spendPoints >= 0
            ? `Đã áp dụng thay đổi (-${spendPoints} điểm).`
            : `Đã áp dụng thay đổi (+${Math.abs(spendPoints)} điểm hoàn lại).`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">Player Lab</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">Player Stats</h2>
              <p className="game-copy mt-3 max-w-2xl text-base">Chon cau thu va chia diem.</p>
            </div>
            <button type="button" onClick={() => refetch()} className="game-button-secondary">
              Tải lại
            </button>
          </div>

          {isLoading && <Banner text="Đang tải danh sách cầu thủ..." tone="info" />}
          {error && <Banner text={(error as Error).message} tone="error" />}
          {feedback?.type === 'err' && <Banner text={feedback.text} tone="error" />}
          {feedback?.type === 'ok' && <Banner text={feedback.text} tone="success" />}

          {!isLoading && cards.length === 0 && (
            <Banner text="Bạn chưa có cầu thủ nào." tone="muted" />
          )}

          {cards.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="game-table min-w-full text-left text-sm">
                <thead className="text-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">Country</th>
                    <th className="px-4 py-3 font-medium">Level</th>
                    <th className="px-4 py-3 font-medium">Points</th>
                    <th className="px-4 py-3 font-medium">Detail</th>
                  </tr>
                  <tr className="hidden">
                    <th className="px-4 py-3 font-medium">Cầu thủ</th>
                    <th className="px-4 py-3 font-medium">Quốc gia</th>
                    <th className="px-4 py-3 font-medium">Cấp độ</th>
                    <th className="px-4 py-3 font-medium">Điểm còn lại</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr
                      key={card.userPlayerId}
                      onClick={() => onSelectCard(card.userPlayerId)}
                      data-active={selectedCard?.userPlayerId === card.userPlayerId}
                      className="cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolvePlayerAvatarUrl(card)}
                            alt={card.name}
                            className="h-10 w-10 rounded-full border border-white/20 bg-white/10 object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                            }}
                          />
                          <div>
                            <p>{card.name}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                              <img
                                src={resolveClubImage({
                                  slug: card.clubSlug,
                                  imgUrl: card.clubImage,
                                  name: card.baseClub,
                                })}
                                alt={card.baseClub || 'Club'}
                                className="h-4 w-4 rounded-full object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                              />
                              <span>{card.baseClub || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="flex items-center gap-2">
                          <img
                            src={resolveCountryImage(card.country)}
                            alt={card.country?.name || 'Country'}
                            className="h-4 w-6 rounded-sm object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                          <span>{card.country?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{card.level}</td>
                      <td className="px-4 py-3 text-emerald-300">{card.currentPoints}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="game-button-ghost px-3 py-2 text-xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailPlayerId(card.userPlayerId);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          {!selectedCard ? (
            <p className="game-notice game-notice--muted">Chọn một cầu thủ để chỉnh chỉ số.</p>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <img
                  src={resolvePlayerAvatarUrl(selectedCard)}
                  alt={selectedCard.name}
                  className="h-14 w-14 rounded-2xl border border-white/20 bg-white/10 object-cover"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
                  }}
                />
                <div>
                  <h3 className="game-title mt-1 text-2xl font-bold text-white">
                    {selectedCard.name}
                  </h3>
                  <p className="text-sm text-slate-400">
                    Cấp {selectedCard.level} · {selectedCard.currentPoints} điểm
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <img
                        src={resolveClubImage({
                          slug: selectedCard.clubSlug,
                          imgUrl: selectedCard.clubImage,
                          name: selectedCard.baseClub,
                        })}
                        alt={selectedCard.baseClub || 'Club'}
                        className="h-5 w-5 rounded-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                      <span>{selectedCard.baseClub || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={resolveCountryImage(selectedCard.country)}
                        alt={selectedCard.country?.name || 'Country'}
                        className="h-4 w-6 rounded-sm object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                      <span>{selectedCard.country?.name || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <form className="mt-4 space-y-2" onSubmit={handleSubmit}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STAT_FIELDS.map(({ key, label }) => (
                    <StatRow
                      key={key}
                      label={label}
                      base={Number(selectedCard.baseStats[key as StatKey] ?? 0)}
                      bonus={Number(selectedCard.bonusStats[key as StatKey] ?? 0)}
                      value={allocate[key as StatKey]}
                      onChange={(v) => updateStat(key as StatKey, v)}
                      canIncrease={
                        clampValue(key as StatKey, allocate[key as StatKey] + 1) >
                        allocate[key as StatKey]
                      }
                      canDecrease={
                        clampValue(key as StatKey, allocate[key as StatKey] - 1) <
                        allocate[key as StatKey]
                      }
                    />
                  ))}
                </div>

                <div className="mt-4 rounded-[18px] border border-white/8 bg-black/20 p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Điểm sẽ dùng</span>
                    <span
                      className={
                        spendPoints > 0
                          ? 'text-amber-300 font-semibold'
                          : spendPoints < 0
                            ? 'text-emerald-300 font-semibold'
                            : 'text-slate-300'
                      }
                    >
                      {spendPoints}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-slate-400">Còn lại sau</span>
                    <span
                      className={
                        projectedPoints < 0
                          ? 'text-red-400 font-semibold'
                          : 'text-slate-200 font-semibold'
                      }
                    >
                      {projectedPoints}
                    </span>
                  </div>
                </div>

                {hasNegativeBonus && (
                  <Banner text="Không thể giảm stat xuống dưới điểm nền." tone="error" />
                )}

                <button
                  type="submit"
                  disabled={!canSubmit || allocateMutation.isPending}
                  className="game-button-primary mt-2 w-full"
                >
                  {allocateMutation.isPending ? 'Đang lưu...' : 'Áp dụng chỉ số'}
                </button>
              </form>
            </>
          )}
        </div>
      </aside>
      {detailPlayerId ? (
        <PlayerDetailPopup
          userPlayerId={detailPlayerId}
          onClose={() => setDetailPlayerId(null)}
        />
      ) : null}
    </section>
  );
}

function StatRow({
  label,
  base,
  bonus,
  value,
  onChange,
  canIncrease,
  canDecrease,
}: {
  label: string;
  base: number;
  bonus: number;
  value: number;
  onChange: (v: number) => void;
  canIncrease: boolean;
  canDecrease: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[14px] border border-white/8 bg-black/20 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 truncate">{label}</p>
        <p className="text-xs text-slate-500">
          nền {base} +{bonus}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={!canDecrease}
        className="w-6 h-6 rounded-lg bg-white/8 text-slate-300 text-sm disabled:opacity-30 hover:bg-white/15"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-12 rounded-lg border border-white/8 bg-black/30 px-1 py-0.5 text-center text-sm text-white"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={!canIncrease}
        className="w-6 h-6 rounded-lg bg-white/8 text-slate-300 text-sm disabled:opacity-30 hover:bg-white/15"
      >
        +
      </button>
    </div>
  );
}
