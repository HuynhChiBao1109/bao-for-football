import { useState } from 'react'

import { apiRequest } from './api'

function GachaPage({ token, sessionData, onUnauthorized }) {
  const [bannerCode, setBannerCode] = useState('special-season')
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])

  const userId = sessionData?.user?.id

  async function rollOnce() {
    if (!userId) {
      setError('Không tìm thấy user hiện tại để thực hiện roll.')
      return
    }

    setRolling(true)
    setError('')

    try {
      const payload = await apiRequest('/api/v1/gacha/roll', {
        method: 'POST',
        token,
        body: {
          userId,
          bannerCode,
        },
      })

      const nextResult = payload?.data || null
      setResult(nextResult)
      setHistory((current) => [nextResult, ...current].filter(Boolean).slice(0, 6))
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorized()
        return
      }
      setError(err.message)
    } finally {
      setRolling(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Gacha cầu thủ</p>
        <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
          Roll trực tiếp bằng gacha API của user hiện tại
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
            <label className="block">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-400">Banner Code</span>
              <input
                value={bannerCode}
                onChange={(event) => setBannerCode(event.target.value)}
                className="w-full rounded-xl border border-[#22306f] bg-[#030712] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#4169ff]"
              />
            </label>

            <button
              type="button"
              onClick={rollOnce}
              disabled={rolling || !bannerCode.trim()}
              className="mt-4 w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {rolling ? 'Rolling...' : 'Roll Player'}
            </button>

            {error && <p className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
          </div>

          <div className="rounded-2xl border border-[#24306e] bg-black/20 p-4">
            {!result ? (
              <p className="rounded-2xl border border-dashed border-[#2a387e] bg-black/20 px-4 py-8 text-center text-sm text-slate-400">
                Chưa có lượt quay nào trong phiên này. Hãy chọn banner rồi roll để xem kết quả API trả về.
              </p>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[#f6d87a]">Latest Roll</p>
                <h3 className="mt-2 text-3xl font-bold text-white">{result.rarity}</h3>
                <p className="mt-1 text-sm text-slate-300">Banner: {result.bannerCode}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Tile label="Season" value={result.season} />
                  <Tile label="Special" value={result.isSpecial ? 'Yes' : 'No'} />
                  <Tile label="Pity Triggered" value={result.isPityTriggered ? 'Yes' : 'No'} />
                  <Tile label="Total Rolls" value={String(result.totalRolls)} />
                  <Tile label="Rolls Since Special" value={String(result.rollsSinceLastSpecial)} />
                  <Tile label="Next Guaranteed Hint" value={result.nextRollGuaranteedHint ? 'Yes' : 'No'} />
                </div>
              </div>
            )}
          </div>
        </div>
      </article>

      <aside className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Roll History</p>
        <div className="mt-4 space-y-3">
          {history.length === 0 && (
            <p className="rounded-2xl border border-dashed border-[#2a387e] bg-black/20 px-4 py-5 text-sm text-slate-400">
              Lịch sử roll của phiên hiện tại sẽ hiện ở đây.
            </p>
          )}

          {history.map((item, index) => (
            <div key={`${item.bannerCode}-${item.totalRolls}-${index}`} className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{item.rarity}</p>
                <p className="text-xs text-slate-400">Roll #{item.totalRolls}</p>
              </div>
              <p className="mt-1 text-sm text-slate-300">{item.bannerCode} • {item.season}</p>
            </div>
          ))}
        </div>
      </aside>
    </section>
  )
}

function Tile({ label, value }) {
  return (
    <div className="rounded-xl border border-[#1d275e] bg-[#08113a]/70 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

export default GachaPage