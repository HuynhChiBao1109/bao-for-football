import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAdminPlayers,
  useAdminPlayer,
  useCreateAdminPlayer,
  useDeleteAdminPlayer,
  useUpdateAdminPlayer,
} from '../../hooks/useAdminPlayers';
import {
  useAdminSkills,
  useCreateSkill,
  useAssignSkill,
  useRemoveSkill,
} from '../../hooks/useAdminSkills';
import { useCountries } from '../../hooks/useCountries';
import { useClubs } from '../../hooks/useClubs';
import { useAuth } from '../../hooks/useAuth';
import { STAT_FIELDS } from '../../lib/constants';
import { Banner } from '../../components/feedback';
import { API_BASE_URL } from '../../lib/apiClient';
import { queryClient } from '../../lib/queryClient';
import { ROUTES } from '../../routes';
import {
  PLAYER_POSITION_OPTIONS,
  PLAYER_SEASON_OPTIONS,
  PlayerPosition,
  PlayerSeason,
} from '../../enums/player';
import type { AdminPlayer, AdminPlayerFilter } from '../../types';

type PositionDraft = {
  position: PlayerPosition;
  description: string;
  effect: number;
};

function calcOverall(source: Record<string, unknown>) {
  const values = STAT_FIELDS.map(({ key }) => Number(source[key] ?? 0)).filter((value) =>
    Number.isFinite(value),
  );
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export function AdminPage() {
  const { token, setSession } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<AdminPlayerFilter>({});
  const [hasLoadedPlayers, setHasLoadedPlayers] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: players = [],
    isLoading: playersLoading,
    error: playersError,
    refetch,
  } = useAdminPlayers(filter, hasLoadedPlayers);
  const { data: countries = [] } = useCountries();
  const { data: clubs = [] } = useClubs();
  const { data: skills = [], refetch: refetchSkills } = useAdminSkills();

  function handleNameChange(value: string) {
    setNameInput(value);
    setHasLoadedPlayers(true);
    if (debounceTimer) clearTimeout(debounceTimer);
    const t = setTimeout(
      () => setFilter((prev) => ({ ...prev, name: value.trim() || undefined })),
      300,
    );
    setDebounceTimer(t);
  }

  function handleRefreshPlayers() {
    if (!hasLoadedPlayers) {
      setHasLoadedPlayers(true);
      return;
    }
    refetch();
  }

  function handleLogout() {
    setSession(null);
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  }

  const uniqueClubNames = Array.from(new Set(clubs.map((c) => c.name).filter(Boolean))).sort();

  return (
    <div className="space-y-6">
      <section className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="game-header-kicker">Admin Foundry</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">
                Quản lí cầu thủ nguồn và kỹ năng đặc biệt
              </h2>
            </div>
            <button type="button" onClick={handleLogout} className="game-button-ghost">
              Logout
            </button>
          </div>
        </div>
      </section>

      {/* Filters + player list */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <PlayerFilters
            nameInput={nameInput}
            filter={filter}
            countries={countries}
            clubNames={uniqueClubNames}
            onNameChange={handleNameChange}
            onCountryChange={(v) => {
              setHasLoadedPlayers(true);
              setFilter((p) => ({ ...p, countryId: v || undefined }));
            }}
            onClubChange={(v) => {
              setHasLoadedPlayers(true);
              setFilter((p) => ({ ...p, baseClub: v || undefined }));
            }}
            onSeasonChange={(v) => {
              setHasLoadedPlayers(true);
              setFilter((p) => ({ ...p, season: v || undefined }));
            }}
            onRefresh={handleRefreshPlayers}
          />
          {hasLoadedPlayers && playersLoading && (
            <Banner text="Đang tải danh sách cầu thủ..." tone="info" />
          )}
          {hasLoadedPlayers && playersError && (
            <Banner text={(playersError as Error).message} tone="error" />
          )}
          {hasLoadedPlayers ? (
            <PlayerTable players={players} selectedId={selectedId} onSelect={setSelectedId} />
          ) : (
            <Banner
              text="Mặc định chưa tải danh sách. Hãy lọc hoặc bấm Tải lại để hiển thị cầu thủ."
              tone="muted"
            />
          )}
        </div>

        <div className="space-y-4">
          {selectedId ? (
            <PlayerDetail
              playerId={selectedId}
              skills={skills}
              countries={countries}
              clubs={clubs}
              onDataChanged={() => {
                handleRefreshPlayers();
                refetchSkills();
              }}
              onDeleted={() => {
                setSelectedId(null);
                handleRefreshPlayers();
              }}
            />
          ) : (
            <div className="game-stat-card">
              <p className="game-stat-card__label">Chi tiết cầu thủ</p>
              <p className="mt-3 text-sm text-slate-400">
                Chọn một cầu thủ trong bảng để xem chi tiết và gán kỹ năng.
              </p>
            </div>
          )}
          <SkillCatalog skills={skills} onCreated={refetchSkills} />
        </div>
      </section>

      {/* Create player form */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* <CreatePlayerCard countries={countries} onCreated={handleRefreshPlayers} title="Tạo cầu thủ mùa thường" defaultSeason="normal" sourceType="base" /> */}
        <CreatePlayerCard
          countries={countries}
          onCreated={handleRefreshPlayers}
          title="Tạo cầu thủ"
          defaultSeason={PlayerSeason.SpecialYear}
          sourceType="gacha_special"
        />
      </section>

      {/* Create gacha banner form */}
      <section>
        <GachaBannerCard token={token} players={players} onCreated={handleRefreshPlayers} />
      </section>
    </div>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function PlayerFilters({
  nameInput,
  filter,
  countries,
  clubNames,
  onNameChange,
  onCountryChange,
  onClubChange,
  onSeasonChange,
  onRefresh,
}: {
  nameInput: string;
  filter: AdminPlayerFilter;
  countries: { id: number; name: string }[];
  clubNames: string[];
  onNameChange: (v: string) => void;
  onCountryChange: (v: number | null) => void;
  onClubChange: (v: string | null) => void;
  onSeasonChange: (v: string | null) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="game-stat-card">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[140px] block">
          <span className="game-field-label">Tìm tên</span>
          <input
            value={nameInput}
            onChange={(e) => onNameChange(e.target.value)}
            className="game-input"
            placeholder="Tên cầu thủ..."
          />
        </label>
        <label className="flex-1 min-w-[120px] block">
          <span className="game-field-label">Quốc gia</span>
          <select
            value={filter.countryId ?? ''}
            onChange={(e) => onCountryChange(e.target.value ? Number(e.target.value) : null)}
            className="game-input"
          >
            <option value="">Tất cả</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[120px] block">
          <span className="game-field-label">CLB gốc</span>
          <select
            value={filter.baseClub ?? ''}
            onChange={(e) => onClubChange(e.target.value || null)}
            className="game-input"
          >
            <option value="">Tất cả</option>
            {clubNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-[120px] block">
          <span className="game-field-label">Mùa giải</span>
          <select
            value={filter.season ?? ''}
            onChange={(e) => onSeasonChange(e.target.value || null)}
            className="game-input"
          >
            <option value="">Tất cả</option>
            {PLAYER_SEASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onRefresh} className="game-button-secondary">
          Tải lại
        </button>
      </div>
    </div>
  );
}

// ─── Player Table ─────────────────────────────────────────────────────────────

function PlayerTable({
  players,
  selectedId,
  onSelect,
}: {
  players: AdminPlayer[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (players.length === 0) return <Banner text="Không có cầu thủ nào khớp bộ lọc." tone="muted" />;

  return (
    <div className="overflow-x-auto">
      <table className="game-table min-w-full text-left text-sm">
        <thead className="text-slate-200">
          <tr>
            <th className="px-3 py-3 font-medium">Cầu thủ</th>
            <th className="px-3 py-3 font-medium">Quốc gia</th>
            <th className="px-3 py-3 font-medium">CLB gốc</th>
            <th className="px-3 py-3 font-medium">Mùa</th>
            <th className="px-3 py-3 font-medium">Overall</th>
            <th className="px-3 py-3 font-medium">Loại</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr
              key={p.id}
              onClick={() => onSelect(p.id)}
              data-active={selectedId === p.id}
              className="cursor-pointer"
            >
              <td className="px-3 py-3 font-medium text-white flex items-center gap-2">
                {p.avatar && (
                  <img
                    src={`${p.avatar}`}
                    alt={p.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                )}
                {p.name}
              </td>
              <td className="px-3 py-3 text-slate-300">{p.country?.name ?? '—'}</td>
              <td className="px-3 py-3 text-slate-300">{p.baseClub}</td>
              <td className="px-3 py-3 text-slate-300">{p.season}</td>
              <td className="px-3 py-3 font-semibold text-emerald-200">
                {calcOverall(p).toFixed(1)}
              </td>
              <td className="px-3 py-3">
                <span
                  className={`game-chip text-xs ${p.sourceType === 'gacha_special' ? 'text-amber-300 border-amber-400/30' : ''}`}
                >
                  {p.sourceType}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Player Detail ────────────────────────────────────────────────────────────

function PlayerDetail({
  playerId,
  skills,
  countries,
  clubs,
  onDataChanged,
  onDeleted,
}: {
  playerId: number;
  skills: { id: number; name: string }[];
  countries: { id: number; name: string }[];
  clubs: { id: number; name: string }[];
  onDataChanged: () => void;
  onDeleted: () => void;
}) {
  const { data: player, isLoading, error } = useAdminPlayer(playerId);
  const assignMutation = useAssignSkill();
  const removeSkillMutation = useRemoveSkill();
  const updateMutation = useUpdateAdminPlayer();
  const deleteMutation = useDeleteAdminPlayer();
  const [selectedSkillId, setSelectedSkillId] = useState<number>(0);
  const [msg, setMsg] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [positions, setPositions] = useState<
    Array<{ position: string; description: string; effect: number }>
  >([]);
  const [positionDraft, setPositionDraft] = useState<PositionDraft>({
    position: PlayerPosition.CF,
    description: '',
    effect: 1,
  });
  const [form, setForm] = useState<Record<string, string | number>>({
    name: '',
    countryId: '',
    clubId: '',
    season: 'normal',
    sourceType: 'base',
    ...Object.fromEntries(STAT_FIELDS.map(({ key }) => [key, 60])),
  });

  useEffect(() => {
    if (!player) return;
    setForm({
      name: player.name ?? '',
      countryId: player.countryId ?? '',
      clubId: player.clubId ?? '',
      season: player.season ?? 'normal',
      sourceType: player.sourceType ?? 'base',
      ...Object.fromEntries(
        STAT_FIELDS.map(({ key }) => [key, Number((player as Record<string, unknown>)[key] ?? 60)]),
      ),
    });
    setPositions(
      (player.positions ?? []).map((item) => ({
        position: item.position,
        description: item.description ?? '',
        effect: Number(item.effect ?? 1),
      })),
    );
    setAvatarFile(null);
    setAvatarPreview('');
    setSelectedSkillId(0);
    setMsg('');
  }, [player]);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!player || !selectedSkillId) return;
    setMsg('');
    try {
      await assignMutation.mutateAsync({
        playerId: player.id,
        skillId: selectedSkillId,
      });
      setMsg('Đã gán kỹ năng thành công.');
      onDataChanged();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function handleRemoveSkill(skillId: number) {
    if (!player) return;
    setMsg('');
    try {
      await removeSkillMutation.mutateAsync({ playerId: player.id, skillId });
      setMsg('Đã gỡ kỹ năng khỏi cầu thủ.');
      onDataChanged();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!player) return;

    setMsg('');
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('positions', JSON.stringify(positions));
    if (avatarFile) {
      fd.append('avatar', avatarFile);
    }

    try {
      await updateMutation.mutateAsync({ playerId: player.id, formData: fd });
      setMsg('Đã cập nhật cầu thủ thành công.');
      onDataChanged();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function handleDelete() {
    if (!player) return;
    const ok = window.confirm(`Xóa cầu thủ ${player.name}?`);
    if (!ok) return;
    setMsg('');
    try {
      await deleteMutation.mutateAsync({ playerId: player.id });
      onDeleted();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  if (isLoading)
    return (
      <div className="game-stat-card">
        <Banner text="Đang tải..." tone="info" />
      </div>
    );
  if (error)
    return (
      <div className="game-stat-card">
        <Banner text={(error as Error).message} tone="error" />
      </div>
    );
  if (!player) return null;

  return (
    <div className="game-stat-card space-y-3">
      <div className="flex items-center gap-3">
        {(avatarPreview || player.avatar) && (
          <img
            src={avatarPreview || player.avatar}
            alt={player.name}
            className="h-14 w-14 rounded-2xl bg-white/10 object-cover"
          />
        )}
        <div>
          <p className="game-header-kicker">Chi tiết</p>
          <h3 className="game-title text-xl font-bold text-white">{player.name}</h3>
          <p className="text-sm text-slate-400">
            {player.country?.name} · {player.baseClub} · {player.season}
          </p>
          <p className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
            Overall {calcOverall(player).toFixed(1)}
          </p>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="game-button-secondary cursor-pointer">
            Đổi avatar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatarFile(file);
                setAvatarPreview(URL.createObjectURL(file));
              }}
            />
          </label>
          {avatarFile && <span className="text-xs text-slate-400">{avatarFile.name}</span>}
        </div>

        <input
          value={String(form.name ?? '')}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          className="game-input"
          placeholder="Tên cầu thủ"
          required
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            value={String(form.countryId ?? '')}
            onChange={(e) => setForm((p) => ({ ...p, countryId: Number(e.target.value) }))}
            className="game-input"
            required
          >
            <option value="" disabled>
              Chọn quốc gia
            </option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={String(form.clubId ?? '')}
            onChange={(e) => setForm((p) => ({ ...p, clubId: Number(e.target.value) }))}
            className="game-input"
            required
          >
            <option value="" disabled>
              Chọn CLB
            </option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={String(form.season ?? 'normal')}
            onChange={(e) => setForm((p) => ({ ...p, season: e.target.value }))}
            className="game-input"
          >
            {PLAYER_SEASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={String(form.sourceType ?? 'base')}
            onChange={(e) => setForm((p) => ({ ...p, sourceType: e.target.value }))}
            className="game-input"
          >
            <option value="base">base</option>
            <option value="gacha_special">gacha_special</option>
          </select>
        </div>

        <div className="rounded-[12px] border border-white/10 bg-black/20 p-3 space-y-2">
          <p className="game-field-label">Position Profiles</p>
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
              onChange={(e) => setPositionDraft((p) => ({ ...p, description: e.target.value }))}
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

          <div className="mt-2 flex flex-wrap gap-2">
            {positions.map((item) => (
              <span
                key={item.position}
                className="game-chip text-xs text-amber-200 border-amber-400/30"
              >
                {item.position} x{Number(item.effect || 0).toFixed(2)}
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
            {positions.length === 0 && (
              <span className="text-xs text-slate-400">
                Đang trống: hệ thống sẽ tự infer 1 position khi update.
              </span>
            )}
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

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={updateMutation.isPending} className="game-button-primary">
            {updateMutation.isPending ? 'Đang cập nhật...' : 'Update cầu thủ'}
          </button>
          <button
            type="button"
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
            className="game-button-ghost text-red-300 border-red-400/30"
          >
            {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa cầu thủ'}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <p className="game-field-label">Kỹ năng đang có</p>
        <div className="flex flex-wrap gap-2">
          {(player.skills ?? []).map((s) => (
            <span key={s.id} className="game-chip text-xs text-emerald-300 border-emerald-400/30">
              {s.name}
              <button
                type="button"
                className="ml-2 text-red-300"
                onClick={() => handleRemoveSkill(s.id)}
                disabled={removeSkillMutation.isPending}
              >
                x
              </button>
            </span>
          ))}
          {(player.skills ?? []).length === 0 && (
            <span className="text-xs text-slate-400">Chưa có kỹ năng.</span>
          )}
        </div>
      </div>

      <form onSubmit={handleAssign} className="space-y-2">
        <p className="game-field-label">Gán kỹ năng</p>
        <div className="flex gap-2">
          <select
            value={selectedSkillId}
            onChange={(e) => setSelectedSkillId(Number(e.target.value))}
            className="game-input flex-1"
          >
            <option value={0} disabled>
              Chọn kỹ năng
            </option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!selectedSkillId || assignMutation.isPending}
            className="game-button-secondary"
          >
            Gán
          </button>
        </div>
        {msg && <p className="text-xs text-emerald-300">{msg}</p>}
      </form>
    </div>
  );
}

// ─── Skill Catalog ────────────────────────────────────────────────────────────

function SkillCatalog({
  skills,
  onCreated,
}: {
  skills: { id: number; name: string; buffType?: string; buffValue?: number }[];
  onCreated: () => void;
}) {
  const createMutation = useCreateSkill();
  const [draft, setDraft] = useState({
    name: '',
    description: '',
    buffType: 'shooting',
    buffValue: 3,
  });
  const [msg, setMsg] = useState('');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await createMutation.mutateAsync(draft);
      setDraft((prev) => ({ ...prev, name: '', description: '' }));
      setMsg('Đã tạo kỹ năng thành công.');
      onCreated();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div className="game-stat-card space-y-3">
      <p className="game-header-kicker">Kỹ Năng Đặc Biệt</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s.id} className="game-chip text-xs">
            {s.name} {s.buffType ? `(+${s.buffValue} ${s.buffType})` : ''}
          </span>
        ))}
        {skills.length === 0 && <p className="text-sm text-slate-400">Chưa có kỹ năng nào.</p>}
      </div>

      <form onSubmit={handleCreate} className="space-y-2">
        <p className="game-field-label">Tạo kỹ năng mới</p>
        <input
          value={draft.name}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
          className="game-input"
          placeholder="Tên kỹ năng"
          required
        />
        <input
          value={draft.description}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          className="game-input"
          placeholder="Mô tả (tùy chọn)"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.buffType}
            onChange={(e) => setDraft((p) => ({ ...p, buffType: e.target.value }))}
            className="game-input"
          >
            {[
              'shooting',
              'passing',
              'longPass',
              'vision',
              'pace',
              'dribbling',
              'stamina',
              'strength',
              'technique',
              'determination',
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={draft.buffValue}
            min={1}
            max={20}
            onChange={(e) => setDraft((p) => ({ ...p, buffValue: Number(e.target.value) }))}
            className="game-input"
          />
        </div>
        {msg && <p className="text-xs text-emerald-300">{msg}</p>}
        <button
          type="submit"
          disabled={!draft.name || createMutation.isPending}
          className="game-button-secondary w-full"
        >
          {createMutation.isPending ? 'Đang tạo...' : 'Tạo kỹ năng'}
        </button>
      </form>
    </div>
  );
}

// ─── Gacha Banner Form ───────────────────────────────────────────────────────

function GachaBannerCard({
  token,
  players,
  onCreated,
}: {
  token: string;
  players: AdminPlayer[];
  onCreated: () => void;
}) {
  const [playerId, setPlayerId] = useState<number>(0);
  const [timeEnd, setTimeEnd] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedPlayer = players.find((player) => player.id === playerId) || null;

  async function uploadBannerImage() {
    if (!bannerFile) return '';

    const formData = new FormData();
    formData.append('image', bannerFile);

    const response = await fetch(`${API_BASE_URL}/api/v1/admin/uploads/image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || 'Không thể upload ảnh banner');
    }

    return data?.data?.url || '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    setErr('');
    setLoading(true);

    try {
      if (!playerId) throw new Error('Vui lòng chọn cầu thủ');
      if (!timeEnd) throw new Error('Vui lòng chọn timeEnd');
      if (!bannerFile) throw new Error('Vui lòng chọn banner image');

      const expiresAt = new Date(timeEnd);
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error('timeEnd không hợp lệ');
      }

      const bannerImageUrl = await uploadBannerImage();
      const payload = {
        bannerCode: `gacha-${playerId}-${Date.now()}`,
        bannerName: `${selectedPlayer?.name || 'Player'} Banner`,
        playerId,
        bannerImageUrl,
        timeEnd: expiresAt.toISOString(),
      };

      const response = await fetch(`${API_BASE_URL}/api/v1/admin/gacha/banners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Không thể tạo banner gacha');
      }

      setMsg('Đã tạo banner gacha thành công.');
      setPlayerId(0);
      setTimeEnd('');
      setBannerFile(null);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview('');
      onCreated();
    } catch (error) {
      setErr((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="game-panel game-panel--soft overflow-hidden p-5">
      <div className="game-panel__content">
        <p className="game-header-kicker">Gacha Admin</p>
        <h3 className="game-title mt-2 text-xl font-bold text-white">Tạo banner gacha</h3>
        <p className="mt-2 text-sm text-slate-400">
          Chọn cầu thủ, upload banner image và đặt thời gian hết hạn.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="game-field-label">Cầu thủ</span>
            <select
              value={String(playerId || '')}
              onChange={(e) => setPlayerId(Number(e.target.value))}
              className="game-input"
            >
              <option value="">Chọn cầu thủ</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.baseClub})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="game-field-label">Time End</span>
            <input
              type="datetime-local"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="game-input"
            />
          </label>

          <label className="block">
            <span className="game-field-label">Banner Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (bannerPreview) URL.revokeObjectURL(bannerPreview);
                setBannerFile(file);
                setBannerPreview(URL.createObjectURL(file));
              }}
              className="game-input"
            />
          </label>

          {bannerPreview && (
            <img
              src={bannerPreview}
              alt="banner preview"
              className="h-40 w-full rounded-2xl object-cover"
            />
          )}
          {msg && <Banner text={msg} tone="success" />}
          {err && <Banner text={err} tone="error" />}

          <button
            type="submit"
            disabled={loading || !playerId || !timeEnd || !bannerFile}
            className="game-button-primary w-full"
          >
            {loading ? 'Đang tạo...' : 'Tạo banner gacha'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Create Player Form ───────────────────────────────────────────────────────

const STAT_DEFAULTS: Record<string, number> = Object.fromEntries(
  STAT_FIELDS.map(({ key }) => [key, 60]),
);

function CreatePlayerCard({
  countries,
  onCreated,
  title,
  defaultSeason,
  sourceType,
}: {
  countries: { id: number; name: string }[];
  onCreated: () => void;
  title: string;
  defaultSeason: string;
  sourceType: string;
}) {
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
          {/* Avatar */}
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
