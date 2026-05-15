import { useEffect, useMemo, useState } from 'react'

import { apiRequest } from './api'

const DEFAULT_FORM = {
  formation: '4-3-3',
  passRatio: 58,
  shotRatio: 42,
  pressure: 61,
}

function TacticsPage({ token, sessionData, user, onUnauthorized }) {
  const [teamSlot, setTeamSlot] = useState(user?.isAdmin ? 'away' : 'home')
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadTactics() {
      setLoading(true)
      setError('')
      setMessage('')

      try {
        const payload = await apiRequest(`/api/v1/tactics/${teamSlot}`, { token })
        const data = payload?.data
        if (!cancelled && data) {
          setForm({
            formation: data.formation || DEFAULT_FORM.formation,
            passRatio: Math.round(Number(data.passRatio || 0) * 100),
            shotRatio: Math.round(Number(data.shotRatio || 0) * 100),
            pressure: Math.round(Number(data.pressure || 0) * 100),
          })
        }
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          onUnauthorized()
          return
        }

        if (err.status === 404) {
          if (!cancelled) {
            setForm(DEFAULT_FORM)
          }
        } else if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTactics()

    return () => {
      cancelled = true
    }
  }, [onUnauthorized, teamSlot, token])

  const total = useMemo(() => form.passRatio + form.shotRatio + form.pressure, [form])

  async function submitForm(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const payload = await apiRequest('/api/v1/tactics', {
        method: 'POST',
        token,
        body: {
          teamId: teamSlot,
          formation: form.formation,
          passRatio: Number(form.passRatio),
          shotRatio: Number(form.shotRatio),
          pressure: Number(form.pressure),
        },
      })

      const data = payload?.data
      if (data) {
        setForm({
          formation: data.formation,
          passRatio: Math.round(Number(data.passRatio || 0) * 100),
          shotRatio: Math.round(Number(data.shotRatio || 0) * 100),
          pressure: Math.round(Number(data.pressure || 0) * 100),
        })
      }
      setMessage('Đã lưu chiến thuật thành công và đẩy sang realtime match engine.')
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized()
        return
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Chiến thuật</p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
              Lấy và lưu chiến thuật qua tactics API
            </h2>
          </div>

          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-2">
            <div className="flex gap-2">
              {['home', 'away'].map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setTeamSlot(slot)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                    teamSlot === slot ? 'bg-[#000080] text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-300">
          Slot realtime hiện tại: <span className="font-semibold text-[#f6d87a]">{teamSlot}</span>. {sessionData?.team?.clubName ? `CLB tham chiếu: ${sessionData.team.clubName}.` : ''}
        </p>

        {loading ? (
          <Notice text="Đang tải config chiến thuật từ server..." tone="info" />
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submitForm}>
            <SelectField
              label="Formation"
              value={form.formation}
              options={['4-3-3', '4-4-2']}
              onChange={(value) => setForm((current) => ({ ...current, formation: value }))}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <SliderField
                label="Pass Ratio"
                value={form.passRatio}
                onChange={(value) => setForm((current) => ({ ...current, passRatio: value }))}
              />
              <SliderField
                label="Shot Ratio"
                value={form.shotRatio}
                onChange={(value) => setForm((current) => ({ ...current, shotRatio: value }))}
              />
              <SliderField
                label="Pressure"
                value={form.pressure}
                onChange={(value) => setForm((current) => ({ ...current, pressure: value }))}
              />
            </div>

            <div className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-4 text-sm text-slate-300">
              Tổng thiên hướng hiện tại: <span className="font-semibold text-[#f6d87a]">{total}</span>
            </div>

            {message && <Notice text={message} tone="success" />}
            {error && <Notice text={error} tone="error" />}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Tactics'}
            </button>
          </form>
        )}
      </article>

      <aside className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Realtime Note</p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
          <p className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3">
            Backend realtime hiện dùng hai slot chiến thuật chuẩn là home và away. Màn này đang thao tác trực tiếp trên đúng cấu trúc đó.
          </p>
          <p className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3">
            Khi nhấn save, chiến thuật được lưu vào service-core rồi push tiếp sang service-realtime để ảnh hưởng logic trận đấu.
          </p>
        </div>
      </aside>
    </section>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#4169ff]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function SliderField({ label, value, onChange }) {
  return (
    <label className="block rounded-2xl border border-[#24306e] bg-black/20 p-4">
      <span className="mb-3 block text-xs uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#4169ff]"
      />
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-slate-400">0</span>
        <span className="font-semibold text-white">{value}</span>
        <span className="text-slate-400">100</span>
      </div>
    </label>
  )
}

function Notice({ text, tone }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
      : tone === 'error'
        ? 'border-red-500/30 bg-red-500/10 text-red-300'
        : 'border-[#24306e] bg-black/20 text-slate-300'

  return <p className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>{text}</p>
}

export default TacticsPage