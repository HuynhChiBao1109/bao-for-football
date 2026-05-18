import { useState } from 'react';
import { useGachaRoll, useGachaBanners, useGachaProgress } from '../hooks/useGacha';
import { useSession } from '../hooks/useSession';
import { Banner } from '../components/feedback';
import { API_BASE_URL } from '../lib/apiClient';
import { GachaBannerStatus } from '../enums/gacha';
import type { GachaBanner, GachaResult } from '../types';

export function GachaPage() {
  const { data: sessionData } = useSession();
  const userId = sessionData?.user?.id;

  const { data: banners = [], isLoading: bannersLoading, error: bannersError } = useGachaBanners();
  const rollMutation = useGachaRoll();

  const [selectedBanner, setSelectedBanner] = useState<GachaBanner | null>(null);
  const { data: progressData } = useGachaProgress(selectedBanner?.bannerCode ?? null);
  const [result, setResult] = useState<GachaResult | null>(null);
  const [history, setHistory] = useState<GachaResult[]>([]);
  const [rollError, setRollError] = useState('');

  async function rollOnce() {
    if (!userId) {
      setRollError('Không tìm thấy user hiện tại để thực hiện roll.');
      return;
    }
    if (!selectedBanner) {
      setRollError('Vui lòng chọn banner trước.');
      return;
    }
    setRollError('');
    try {
      const data = await rollMutation.mutateAsync({
        userId,
        bannerCode: selectedBanner.bannerCode,
      });
      setResult(data);
      setHistory((prev) => [data, ...prev].slice(0, 10));
    } catch (err) {
      setRollError((err as Error).message);
    }
  }

  function formatExpiry(dateStr?: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Scout Capsule</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">
            Phòng quay tuyển trạch cầu thủ
          </h2>
          <p className="game-copy mt-3 max-w-2xl text-base">
            Chọn banner đang hoạt động, nổ capsule và nhận cầu thủ cùng thông tin pity của bạn.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          {/* Banner list */}
          <section>
            <p className="game-header-kicker mb-3">Banner đang hoạt động</p>
            {bannersLoading && <Banner text="Đang tải danh sách banner..." tone="info" />}
            {bannersError && <Banner text={(bannersError as Error).message} tone="error" />}
            {!bannersLoading && banners.length === 0 && (
              <div className="rounded-[18px] border border-dashed border-white/12 bg-black/20 px-4 py-10 text-center text-sm text-slate-400">
                Hiện không có banner nào đang hoạt động.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {banners.map((b) => (
                <BannerCard
                  key={b.id}
                  banner={b}
                  selected={selectedBanner?.id === b.id}
                  onSelect={() => {
                    setSelectedBanner(b);
                    setResult(null);
                    setRollError('');
                  }}
                  formatExpiry={formatExpiry}
                />
              ))}
            </div>
          </section>

          {/* Roll panel */}
          {selectedBanner && (
            <section className="game-panel game-panel--soft overflow-hidden p-5">
              <div className="game-panel__content">
                <p className="game-header-kicker">Banner đã chọn</p>
                <h3 className="game-title mt-2 text-xl font-bold text-white">
                  {selectedBanner.bannerName}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Hết hạn: {formatExpiry(selectedBanner.expiredAt)} · Code:{' '}
                  <span className="text-slate-300">{selectedBanner.bannerCode}</span>
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
                        <p className="game-field-label mb-0">Tổng roll</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {progressData?.totalRolls ?? 0}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
                        <p className="game-field-label mb-0">Pity counter</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {progressData?.rollsSinceSpecial ?? 0}
                        </p>
                      </div>
                    </div>

                    {rollError && <Banner text={rollError} tone="error" />}

                    <button
                      type="button"
                      onClick={rollOnce}
                      disabled={rollMutation.isPending}
                      className="game-button-primary w-full"
                    >
                      {rollMutation.isPending ? 'Đang quay...' : '⚡ Quay ngay'}
                    </button>
                  </div>

                  <div>
                    {!result ? (
                      <div className="rounded-[18px] border border-dashed border-white/12 bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                        Kết quả lượt quay sẽ hiển thị ở đây.
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-amber-400/20 bg-black/20 px-4 py-4 space-y-3">
                        <p className="game-stat-card__label text-amber-200">Kết quả</p>

                        {/* Player display */}
                        <div className="bg-black/40 rounded-[12px] p-3">
                          {result.playerImageUrl && (
                            <div className="relative h-32 w-full overflow-hidden rounded-[8px] bg-black/30 mb-2">
                              <img
                                src={result.playerImageUrl}
                                alt={result.playerName}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                          <p className="text-sm font-semibold text-white truncate">
                            {result.playerName}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">ID: {result.playerId}</p>
                        </div>

                        <h3 className="font-['Orbitron'] text-3xl font-bold text-white">
                          {result.rarity}
                        </h3>
                        <p className="text-sm text-slate-300">
                          {result.bannerCode} · {result.season}
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Tile label="Đặc biệt" value={result.isSpecial ? 'Có' : 'Không'} />
                          <Tile
                            label="Pity"
                            value={result.isPityTriggered ? 'Kích hoạt' : 'Chưa'}
                          />
                          <Tile label="Tổng roll" value={String(result.totalRolls)} />
                          <Tile
                            label="Đảm bảo tiếp theo"
                            value={result.nextRollGuaranteedHint ? 'Có' : 'Không'}
                          />
                        </div>
                        <div className="pt-2 border-t border-white/8">
                          <p className="text-xs text-slate-400">
                            Chi phí:{' '}
                            <span className="text-amber-300 font-semibold">
                              {result.costDeducted.toLocaleString()}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Roll history */}
        <aside className="game-panel overflow-hidden p-5">
          <div className="game-panel__content">
            <p className="game-header-kicker">Lịch sử roll</p>
            <div className="mt-4 space-y-2">
              {history.length === 0 && (
                <p className="rounded-[18px] border border-dashed border-white/12 bg-black/20 px-4 py-5 text-sm text-slate-400">
                  Lịch sử roll của phiên hiện tại sẽ hiện ở đây.
                </p>
              )}
              {history.map((item, i) => (
                <div key={`${item.bannerCode}-${item.totalRolls}-${i}`} className="game-stat-card">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.rarity}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.playerName}</p>
                    </div>
                    <p className="text-xs text-slate-500">#{item.totalRolls}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{item.bannerCode}</p>
                  {item.isSpecial && (
                    <span className="mt-1 inline-block game-chip text-xs text-amber-300 border-amber-400/30">
                      Đặc biệt
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Banner Card ──────────────────────────────────────────────────────────────

function BannerCard({
  banner,
  selected,
  onSelect,
  formatExpiry,
}: {
  banner: GachaBanner;
  selected: boolean;
  onSelect: () => void;
  formatExpiry: (d?: string) => string;
}) {
  const imgSrc = banner.bannerImageUrl
    ? banner.bannerImageUrl.startsWith('http')
      ? banner.bannerImageUrl
      : `${API_BASE_URL}${banner.bannerImageUrl}`
    : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={selected}
      className={`group relative w-full overflow-hidden rounded-[18px] border text-left transition-all
        ${
          selected
            ? 'border-amber-400/60 ring-2 ring-amber-400/30'
            : 'border-white/8 hover:border-white/20'
        } bg-black/30`}
    >
      {/* Banner image */}
      <div className="relative h-36 w-full overflow-hidden bg-black/40">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={banner.bannerName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500 text-xs">
            Không có ảnh
          </div>
        )}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber-400/10">
            <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-black">
              Đã chọn
            </span>
          </div>
        )}
        <div
          className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            banner.status === GachaBannerStatus.Active
              ? 'bg-emerald-500/90 text-white'
              : 'bg-slate-500/80 text-white'
          }`}
        >
          {banner.statusLabel}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <p className="text-sm font-semibold text-white leading-tight">{banner.bannerName}</p>
        <p className="text-[11px] text-slate-400">Hết hạn: {formatExpiry(banner.expiredAt)}</p>
      </div>
    </button>
  );
}

// ─── Tile ─────────────────────────────────────────────────────────────────────

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-white/8 bg-black/20 px-3 py-2">
      <p className="game-field-label mb-0 text-[11px]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
