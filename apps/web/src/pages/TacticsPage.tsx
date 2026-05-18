import { useState, useMemo } from 'react'
import { useTactics, useSaveTactics } from '../hooks/useTactics'
import { useSession } from '../hooks/useSession'
import { Banner } from '../components/ui/Banner'
import type { Tactics } from '../types'

const DEFAULT_TACTICS: Tactics = {
  formation: '4-3-3',
  passRatio: 58,
  shotRatio: 42,
  pressure: 61,
  mode: 'casual',
  gameplay: {
    passSpeedScale: 1.05,
    interceptionRadius: 1.02,
    gkBuildUpBias: 1,
    tempoScale: 1.05,
  },
}

export function TacticsPage() {
  const { data: sessionData } = useSession()
  const tacticsTeamId = sessionData?.team?.tacticsTeamId ?? (sessionData?.user?.id ? `user-${sessionData.user.id}` : '')

  const { data: loaded, isLoading, error: loadError } = useTactics(tacticsTeamId || undefined)
  const saveMutation = useSaveTactics()

  const [form, setForm] = useState<Tactics>(DEFAULT_TACTICS)
  const [initialized, setInitialized] = useState(false)
  const [message, setMessage] = useState('')

  if (loaded && !initialized) {
    setForm(loaded ?? DEFAULT_TACTICS)
    setInitialized(true)
  }

  const total = useMemo(() => form.passRatio + form.shotRatio + form.pressure, [form])

  async function submitForm(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    try {
      const result = await saveMutation.mutateAsync({ teamId: tacticsTeamId, ...form })
      setForm(result)
      setMessage('Đã lưu chiến thuật thành công và đẩy sang realtime match engine.')
    } catch { /* handled below */ }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Tactics Forge</p>
          <h2 className="game-title mt-3 text-3xl font-bold text-white">Bảng điều khiển lối chơi đội bóng</h2>
          <p className="game-copy mt-3 max-w-2xl text-base">Chỉnh logic triển khai bóng, áp lực và gameplay modifiers, sau đó lưu thẳng sang service realtime.</p>

          <p className="mt-4 text-sm leading-6 text-slate-300">
            Tactics Team ID:{' '}
            <span className="font-semibold text-emerald-300">{tacticsTeamId || 'N/A'}</span>
            {sessionData?.team?.clubName ? ` · CLB: ${sessionData.team.clubName}` : ''}
          </p>

          {isLoading && <Banner text="Đang tải config chiến thuật từ server..." tone="info" />}
          {loadError && <Banner text={(loadError as Error).message} tone="error" />}
          {message && <Banner text={message} tone="success" />}
          {saveMutation.error && <Banner text={(saveMutation.error as Error).message} tone="error" />}

          {!isLoading && (
            <form className="mt-5 space-y-4" onSubmit={submitForm}>
              <FormSelect
                label="Formation"
                value={form.formation}
                options={['4-3-3', '4-4-2']}
                onChange={(v) => setForm((p) => ({ ...p, formation: v }))}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <SliderField label="Pass Ratio" value={form.passRatio} onChange={(v) => setForm((p) => ({ ...p, passRatio: v }))} />
                <SliderField label="Shot Ratio" value={form.shotRatio} onChange={(v) => setForm((p) => ({ ...p, shotRatio: v }))} />
                <SliderField label="Pressure" value={form.pressure} onChange={(v) => setForm((p) => ({ ...p, pressure: v }))} />
              </div>

              <div className="text-xs text-slate-400">Tổng 3 slider: <span className={total > 200 ? 'text-red-400' : 'text-emerald-300'}>{total}</span></div>

              <div className="grid gap-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <FormSelect
                  label="Match Mode Profile"
                  value={form.mode}
                  options={['ranked', 'casual', 'ai_campaign']}
                  onChange={(v) => setForm((p) => ({ ...p, mode: v }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ScaledSlider label="Pass Speed Scale" value={form.gameplay.passSpeedScale} min={0.65} max={1.45} step={0.01} onChange={(v) => setForm((p) => ({ ...p, gameplay: { ...p.gameplay, passSpeedScale: v } }))} />
                  <ScaledSlider label="Interception Radius" value={form.gameplay.interceptionRadius} min={0.55} max={1.6} step={0.01} onChange={(v) => setForm((p) => ({ ...p, gameplay: { ...p.gameplay, interceptionRadius: v } }))} />
                  <ScaledSlider label="GK Build-up Bias" value={form.gameplay.gkBuildUpBias} min={0.5} max={2.0} step={0.01} onChange={(v) => setForm((p) => ({ ...p, gameplay: { ...p.gameplay, gkBuildUpBias: v } }))} />
                  <ScaledSlider label="Tempo Scale" value={form.gameplay.tempoScale} min={0.6} max={1.6} step={0.01} onChange={(v) => setForm((p) => ({ ...p, gameplay: { ...p.gameplay, tempoScale: v } }))} />
                </div>
              </div>

              <button type="submit" disabled={saveMutation.isPending || !tacticsTeamId} className="game-button-primary w-full">
                {saveMutation.isPending ? 'Đang lưu...' : 'Lưu Chiến Thuật'}
              </button>
            </form>
          )}
        </div>
      </article>

      <aside className="game-panel overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <p className="game-header-kicker">Tactics Preview</p>
          <div className="mt-4 space-y-3">
            {[
              ['Formation', form.formation],
              ['Pass Ratio', `${form.passRatio}%`],
              ['Shot Ratio', `${form.shotRatio}%`],
              ['Pressure', `${form.pressure}%`],
              ['Mode', form.mode],
              ['Pass Speed', form.gameplay.passSpeedScale.toFixed(2)],
              ['Interception', form.gameplay.interceptionRadius.toFixed(2)],
              ['GK Build-up', form.gameplay.gkBuildUpBias.toFixed(2)],
              ['Tempo', form.gameplay.tempoScale.toFixed(2)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-[14px] border border-white/8 bg-black/20 px-4 py-2.5">
                <span className="text-slate-400 text-sm">{label}</span>
                <strong className="text-white">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  )
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="game-input">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function SliderField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}: <strong className="text-white">{value}%</strong></span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="game-range w-full" />
    </label>
  )
}

function ScaledSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="game-field-label">{label}: <strong className="text-white">{value.toFixed(2)}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="game-range w-full" />
    </label>
  )
}
