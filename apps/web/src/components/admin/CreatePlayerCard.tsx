import { useState } from 'react';
import { useClubs } from '../../hooks/useClubs';
import { useCreateAdminPlayer } from '../../hooks/admin';
import { STAT_FIELDS } from '../../lib/constants';
import { Banner } from '../feedback';
import { PLAYER_POSITION_OPTIONS, PLAYER_SEASON_OPTIONS, PlayerPosition } from '../../enums/player';

type PositionDraft = {
  position: PlayerPosition;
  description: string;
  effect: number;
};

type Props = {
  countries: { id: number; name: string }[];
  onCreated: () => void;
  title: string;
  defaultSeason: string;
  sourceType: string;
};

const STAT_DEFAULTS: Record<string, number> = Object.fromEntries(
  STAT_FIELDS.map(({ key }) => [key, 60]),
);

export function CreatePlayerCard({
  countries,
  onCreated,
  title,
  defaultSeason,
  sourceType,
}: Props) {
  const createMutation = useCreateAdminPlayer();
  const { data: clubs = [] } = useClubs();

  const [form, setForm] = useState<Record<string, string | number>>({
    name: '',
    countryId: countries[0]?.id ?? '',
    clubId: '',
    season: defaultSeason,
    sourceType,
    specialSkill: '',
    ...STAT_DEFAULTS,
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [positions, setPositions] = useState<
    Array<{ position: string; description: string; effect: number }>
  >([]);
  const [positionDraft, setPositionDraft] = useState<PositionDraft>({
    position: PlayerPosition.CF,
    description: '',
    effect: 1,
  });

  function handleFile(file: File) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setErr('');

    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('positions', JSON.stringify(positions));
    if (avatarFile) fd.append('avatar', avatarFile);

    try {
      await createMutation.mutateAsync(fd);
      setMsg(`Đã tạo cầu thủ "${form.name}" thành công.`);
      setForm((prev) => ({
        ...prev,
        name: '',
        specialSkill: '',
        ...STAT_DEFAULTS,
      }));
      setPositions([]);
      setPositionDraft({ position: PlayerPosition.CF, description: '', effect: 1 });
      setAvatarFile(null);
      setAvatarPreview('');
      onCreated();
    } catch (error) {
      setErr((error as Error).message);
    }
  }

  return (
    <div className="game-panel game-panel--soft overflow-hidden p-5">
      <div className="game-panel__content">
        <p className="game-header-kicker">{title}</p>
        <h3 className="game-title mt-2 text-xl font-bold text-white">Tạo cầu thủ mới</h3>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20"
              onClick={() => document.getElementById(`avatar-${sourceType}`)?.click()}
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="preview"
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <span className="text-xs text-slate-400">Ảnh</span>
              )}
            </div>
            <input
              id={`avatar-${sourceType}`}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <p className="text-xs text-slate-400">Click để chọn ảnh đại diện (tùy chọn)</p>
          </div>

          <input
            value={String(form.name)}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="game-input"
            placeholder="Tên cầu thủ *"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={String(form.countryId)}
              onChange={(e) => setForm((p) => ({ ...p, countryId: e.target.value }))}
              className="game-input"
            >
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={String(form.clubId)}
              onChange={(e) => setForm((p) => ({ ...p, clubId: e.target.value }))}
              className="game-input"
            >
              <option value="">Chọn CLB gốc</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <label className="block">
            <span className="game-field-label">Mùa (Season)</span>
            <select
              value={String(form.season)}
              onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))}
              className="game-input"
            >
              {PLAYER_SEASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-[12px] border border-white/10 bg-black/20 p-3 space-y-2">
            <p className="game-field-label">Position + Effect (0 &lt; effect &lt;= 1)</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_110px_1fr_auto]">
              <select
                value={positionDraft.position}
                onChange={(e) =>
                  setPositionDraft((p) => ({ ...p, position: e.target.value as PlayerPosition }))
                }
                className="game-input"
              >
                {PLAYER_POSITION_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={positionDraft.effect}
                onChange={(e) =>
                  setPositionDraft((p) => ({
                    ...p,
                    effect: Number(e.target.value),
                  }))
                }
                className="game-input"
              />
              <input
                value={positionDraft.description}
                onChange={(e) =>
                  setPositionDraft((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
                className="game-input"
                placeholder="Description"
              />
              <button
                type="button"
                className="game-button-secondary"
                onClick={() => {
                  const effect = Math.max(0.1, Math.min(1, Number(positionDraft.effect || 0)));
                  setPositions((prev) => {
                    const next = prev.filter((item) => item.position !== positionDraft.position);
                    next.push({
                      position: positionDraft.position,
                      description: positionDraft.description.trim(),
                      effect,
                    });
                    return next;
                  });
                }}
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {positions.length === 0 && (
                <span className="text-xs text-slate-400">
                  Không chọn sẽ auto infer 1 position mặc định.
                </span>
              )}
              {positions.map((item) => (
                <span key={item.position} className="game-chip text-xs">
                  {item.position} x{item.effect.toFixed(2)}
                  {item.description ? ` · ${item.description}` : ''}
                  <button
                    type="button"
                    className="ml-2 text-red-300"
                    onClick={() =>
                      setPositions((prev) => prev.filter((p) => p.position !== item.position))
                    }
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STAT_FIELDS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-[12px] border border-white/8 bg-black/20 px-3 py-2"
              >
                <span className="flex-1 text-xs text-slate-400 truncate">{label}</span>
                <input
                  type="number"
                  value={Number(form[key] ?? 60)}
                  min={1}
                  max={99}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: Number(e.target.value) }))}
                  className="w-14 rounded-lg border border-white/8 bg-black/30 px-1 py-0.5 text-center text-sm text-white"
                />
              </label>
            ))}
          </div>

          {msg && <Banner text={msg} tone="success" />}
          {err && <Banner text={err} tone="error" />}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="game-button-primary w-full"
          >
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo cầu thủ'}
          </button>
        </form>
      </div>
    </div>
  );
}
