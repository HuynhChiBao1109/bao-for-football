import { useState } from 'react'
import { useAdminPlayers, useAdminPlayer, useCreateAdminPlayer } from '../hooks/useAdminPlayers'
import { useAdminSkills, useCreateSkill, useAssignSkill } from '../hooks/useAdminSkills'
import { useCountries } from '../hooks/useCountries'
import { useClubs } from '../hooks/useClubs'
import { STAT_FIELDS } from '../lib/constants'
import { Banner } from '../components/ui/Banner'
import { API_BASE_URL } from '../lib/apiClient'
import type { AdminPlayer, AdminPlayerFilter } from '../types'

// ─── Admin Page ───────────────────────────────────────────────────────────────

export function AdminPage() {
  const [filter, setFilter] = useState<AdminPlayerFilter>({})
  const [nameInput, setNameInput] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const { data: players = [], isLoading: playersLoading, error: playersError, refetch } = useAdminPlayers(filter)
  const { data: countries = [] } = useCountries()
  const { data: clubs = [] } = useClubs()
  const { data: skills = [], refetch: refetchSkills } = useAdminSkills()

  function handleNameChange(value: string) {
    setNameInput(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    const t = setTimeout(() => setFilter((prev) => ({ ...prev, name: value.trim() || undefined })), 300)
    setDebounceTimer(t)
  }

  const uniqueClubNames = Array.from(new Set(clubs.map((c) => c.name).filter(Boolean))).sort()

  return (
    <div className="space-y-6">
      <section className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Admin Foundry</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">Quản lí cầu thủ nguồn và kỹ năng đặc biệt</h2>
          <p className="game-copy mt-3 max-w-2xl text-base">Tạo cầu thủ mới, gán kỹ năng đặc biệt, tạo banner gacha và kiểm tra pool nguồn quốc gia.</p>
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
            onCountryChange={(v) => setFilter((p) => ({ ...p, countryId: v || undefined }))}
            onClubChange={(v) => setFilter((p) => ({ ...p, baseClub: v || undefined }))}
            onRefresh={refetch}
          />
          {playersLoading && <Banner text="Đang tải danh sách cầu thủ..." tone="info" />}
          {playersError && <Banner text={(playersError as Error).message} tone="error" />}
          <PlayerTable players={players} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="space-y-4">
          {selectedId ? (
            <PlayerDetail playerId={selectedId} skills={skills} onSkillAssigned={() => { refetch(); refetchSkills() }} />
          ) : (
            <div className="game-stat-card">
              <p className="game-stat-card__label">Chi tiết cầu thủ</p>
              <p className="mt-3 text-sm text-slate-400">Chọn một cầu thủ trong bảng để xem chi tiết và gán kỹ năng.</p>
            </div>
          )}
          <SkillCatalog skills={skills} onCreated={refetchSkills} />
        </div>
      </section>

      {/* Create player form */}
      <section className="grid gap-6 lg:grid-cols-2">
        <CreatePlayerCard countries={countries} onCreated={refetch} title="Tạo cầu thủ mùa thường" season="2024" sourceType="base" />
        <CreatePlayerCard countries={countries} onCreated={refetch} title="Tạo cầu thủ đặc biệt (Gacha)" season="2024-special" sourceType="gacha_special" />
      </section>
    </div>
  )
}

// ─── Filters ──────────────────────────────────────────────────────────────────

function PlayerFilters({ nameInput, filter, countries, clubNames, onNameChange, onCountryChange, onClubChange, onRefresh }: {
  nameInput: string
  filter: AdminPlayerFilter
  countries: { id: number; name: string }[]
  clubNames: string[]
  onNameChange: (v: string) => void
  onCountryChange: (v: number | null) => void
  onClubChange: (v: string | null) => void
  onRefresh: () => void
}) {
  return (
    <div className="game-stat-card">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[140px] block">
          <span className="game-field-label">Tìm tên</span>
          <input value={nameInput} onChange={(e) => onNameChange(e.target.value)} className="game-input" placeholder="Tên cầu thủ..." />
        </label>
        <label className="flex-1 min-w-[120px] block">
          <span className="game-field-label">Quốc gia</span>
          <select value={filter.countryId ?? ''} onChange={(e) => onCountryChange(e.target.value ? Number(e.target.value) : null)} className="game-input">
            <option value="">Tất cả</option>
            {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex-1 min-w-[120px] block">
          <span className="game-field-label">CLB gốc</span>
          <select value={filter.baseClub ?? ''} onChange={(e) => onClubChange(e.target.value || null)} className="game-input">
            <option value="">Tất cả</option>
            {clubNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" onClick={onRefresh} className="game-button-secondary">Tải lại</button>
      </div>
    </div>
  )
}

// ─── Player Table ─────────────────────────────────────────────────────────────

function PlayerTable({ players, selectedId, onSelect }: { players: AdminPlayer[]; selectedId: number | null; onSelect: (id: number) => void }) {
  if (players.length === 0) return <Banner text="Không có cầu thủ nào khớp bộ lọc." tone="muted" />

  return (
    <div className="overflow-x-auto">
      <table className="game-table min-w-full text-left text-sm">
        <thead className="text-slate-200">
          <tr>
            <th className="px-3 py-3 font-medium">Cầu thủ</th>
            <th className="px-3 py-3 font-medium">Quốc gia</th>
            <th className="px-3 py-3 font-medium">CLB gốc</th>
            <th className="px-3 py-3 font-medium">Mùa</th>
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
                {p.avatar && <img src={`${API_BASE_URL}${p.avatar}`} alt={p.name} className="h-8 w-8 rounded-lg object-cover" />}
                {p.name}
              </td>
              <td className="px-3 py-3 text-slate-300">{p.country?.name ?? '—'}</td>
              <td className="px-3 py-3 text-slate-300">{p.baseClub}</td>
              <td className="px-3 py-3 text-slate-300">{p.season}</td>
              <td className="px-3 py-3">
                <span className={`game-chip text-xs ${p.sourceType === 'gacha_special' ? 'text-amber-300 border-amber-400/30' : ''}`}>{p.sourceType}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Player Detail ────────────────────────────────────────────────────────────

function PlayerDetail({ playerId, skills, onSkillAssigned }: { playerId: number; skills: { id: number; name: string }[]; onSkillAssigned: () => void }) {
  const { data: player, isLoading, error } = useAdminPlayer(playerId)
  const assignMutation = useAssignSkill()
  const [selectedSkillId, setSelectedSkillId] = useState<number>(0)
  const [assignMsg, setAssignMsg] = useState('')

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!player || !selectedSkillId) return
    setAssignMsg('')
    try {
      await assignMutation.mutateAsync({ playerId: player.id, skillId: selectedSkillId })
      setAssignMsg('Đã gán kỹ năng thành công.')
      onSkillAssigned()
    } catch (err) {
      setAssignMsg((err as Error).message)
    }
  }

  if (isLoading) return <div className="game-stat-card"><Banner text="Đang tải..." tone="info" /></div>
  if (error) return <div className="game-stat-card"><Banner text={(error as Error).message} tone="error" /></div>
  if (!player) return null

  return (
    <div className="game-stat-card space-y-3">
      <div className="flex items-center gap-3">
        {player.avatar && (
          <img src={`${API_BASE_URL}${player.avatar}`} alt={player.name} className="h-14 w-14 rounded-2xl bg-white/10 object-cover" />
        )}
        <div>
          <p className="game-header-kicker">Chi tiết</p>
          <h3 className="game-title text-xl font-bold text-white">{player.name}</h3>
          <p className="text-sm text-slate-400">{player.country?.name} · {player.baseClub} · {player.season}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {STAT_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex justify-between rounded-[12px] border border-white/8 bg-black/20 px-3 py-2 text-sm">
            <span className="text-slate-400">{label}</span>
            <strong className="text-white">{(player as Record<string, unknown>)[key] as number ?? 0}</strong>
          </div>
        ))}
      </div>

      {player.skills && player.skills.length > 0 && (
        <div>
          <p className="game-field-label">Kỹ năng đặc biệt</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {player.skills.map((s) => (
              <span key={s.id} className="game-chip text-xs text-emerald-300 border-emerald-400/30">{s.name}</span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAssign} className="space-y-2">
        <p className="game-field-label">Gán kỹ năng</p>
        <div className="flex gap-2">
          <select value={selectedSkillId} onChange={(e) => setSelectedSkillId(Number(e.target.value))} className="game-input flex-1">
            <option value={0} disabled>Chọn kỹ năng</option>
            {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" disabled={!selectedSkillId || assignMutation.isPending} className="game-button-secondary">Gán</button>
        </div>
        {assignMsg && <p className="text-xs text-emerald-300">{assignMsg}</p>}
      </form>
    </div>
  )
}

// ─── Skill Catalog ────────────────────────────────────────────────────────────

function SkillCatalog({ skills, onCreated }: { skills: { id: number; name: string; buffType?: string; buffValue?: number }[]; onCreated: () => void }) {
  const createMutation = useCreateSkill()
  const [draft, setDraft] = useState({ name: '', description: '', buffType: 'shooting', buffValue: 3 })
  const [msg, setMsg] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    try {
      await createMutation.mutateAsync(draft)
      setDraft((prev) => ({ ...prev, name: '', description: '' }))
      setMsg('Đã tạo kỹ năng thành công.')
      onCreated()
    } catch (err) {
      setMsg((err as Error).message)
    }
  }

  return (
    <div className="game-stat-card space-y-3">
      <p className="game-header-kicker">Kỹ Năng Đặc Biệt</p>
      <div className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <span key={s.id} className="game-chip text-xs">{s.name} {s.buffType ? `(+${s.buffValue} ${s.buffType})` : ''}</span>
        ))}
        {skills.length === 0 && <p className="text-sm text-slate-400">Chưa có kỹ năng nào.</p>}
      </div>

      <form onSubmit={handleCreate} className="space-y-2">
        <p className="game-field-label">Tạo kỹ năng mới</p>
        <input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} className="game-input" placeholder="Tên kỹ năng" required />
        <input value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} className="game-input" placeholder="Mô tả (tùy chọn)" />
        <div className="grid grid-cols-2 gap-2">
          <select value={draft.buffType} onChange={(e) => setDraft((p) => ({ ...p, buffType: e.target.value }))} className="game-input">
            {['shooting', 'passing', 'longPass', 'vision', 'pace', 'dribbling', 'stamina', 'strength', 'technique', 'determination'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input type="number" value={draft.buffValue} min={1} max={20} onChange={(e) => setDraft((p) => ({ ...p, buffValue: Number(e.target.value) }))} className="game-input" />
        </div>
        {msg && <p className="text-xs text-emerald-300">{msg}</p>}
        <button type="submit" disabled={!draft.name || createMutation.isPending} className="game-button-secondary w-full">
          {createMutation.isPending ? 'Đang tạo...' : 'Tạo kỹ năng'}
        </button>
      </form>
    </div>
  )
}

// ─── Create Player Form ───────────────────────────────────────────────────────

const STAT_DEFAULTS: Record<string, number> = Object.fromEntries(STAT_FIELDS.map(({ key }) => [key, 60]))

function CreatePlayerCard({ countries, onCreated, title, season, sourceType }: {
  countries: { id: number; name: string }[]
  onCreated: () => void
  title: string
  season: string
  sourceType: string
}) {
  const createMutation = useCreateAdminPlayer()
  const { data: clubs = [] } = useClubs()

  const [form, setForm] = useState<Record<string, string | number>>({
    name: '', countryId: countries[0]?.id ?? '', baseClub: '', season, sourceType, specialSkill: '', ...STAT_DEFAULTS,
  })
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  function handleFile(file: File) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setErr('')

    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
    if (avatarFile) fd.append('avatar', avatarFile)

    try {
      await createMutation.mutateAsync(fd)
      setMsg(`Đã tạo cầu thủ "${form.name}" thành công.`)
      setForm((prev) => ({ ...prev, name: '', specialSkill: '', ...STAT_DEFAULTS }))
      setAvatarFile(null)
      setAvatarPreview('')
      onCreated()
    } catch (error) {
      setErr((error as Error).message)
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
                <img src={avatarPreview} alt="preview" className="h-16 w-16 rounded-2xl object-cover" />
              ) : (
                <span className="text-xs text-slate-400">Ảnh</span>
              )}
            </div>
            <input id={`avatar-${sourceType}`} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <p className="text-xs text-slate-400">Click để chọn ảnh đại diện (tùy chọn)</p>
          </div>

          <input value={String(form.name)} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="game-input" placeholder="Tên cầu thủ *" required />

          <div className="grid grid-cols-2 gap-3">
            <select value={String(form.countryId)} onChange={(e) => setForm((p) => ({ ...p, countryId: e.target.value }))} className="game-input">
              {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={String(form.baseClub)} onChange={(e) => setForm((p) => ({ ...p, baseClub: e.target.value }))} className="game-input">
              <option value="">Chọn CLB gốc</option>
              {clubs.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {STAT_FIELDS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 rounded-[12px] border border-white/8 bg-black/20 px-3 py-2">
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

          <button type="submit" disabled={createMutation.isPending} className="game-button-primary w-full">
            {createMutation.isPending ? 'Đang tạo...' : 'Tạo cầu thủ'}
          </button>
        </form>
      </div>
    </div>
  )
}
