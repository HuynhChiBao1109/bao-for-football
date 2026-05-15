import { useMemo, useState } from 'react'

import MatchView from './MatchView.jsx'

const TOTAL_LEVELS = 50

function AiMatchPage() {
  const [selectedLevel, setSelectedLevel] = useState(1)
  const [isFighting, setIsFighting] = useState(false)

  const levels = useMemo(() => {
    return Array.from({ length: TOTAL_LEVELS }, (_, idx) => {
      const level = idx + 1
      return {
        level,
        rewardMoney: 1500 + level * 450,
        rewardExp: 70 + level * 18,
      }
    })
  }, [])

  const selected = levels[selectedLevel - 1]

  if (isFighting) {
    return (
      <section className="space-y-4">
        <div className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-4 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Đấu với máy</p>
              <h2 className="mt-1 font-['Space_Grotesk'] text-2xl font-semibold text-white">
                Màn {selected.level}
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Phần thưởng khi thắng: {selected.rewardMoney.toLocaleString()} tiền + {selected.rewardExp} EXP mỗi cầu thủ thi đấu.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsFighting(false)}
              className="rounded-xl border border-[#2a387e] bg-black/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[#4169ff] hover:bg-white/5"
            >
              Quay lại chọn màn
            </button>
          </div>
        </div>

        <MatchView embedded />
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <article className="rounded-3xl border border-[#1c255b] bg-[#050814]/95 p-5 shadow-[0_24px_60px_-28px_rgba(0,0,128,0.8)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Đấu với máy</p>
            <h2 className="mt-2 font-['Space_Grotesk'] text-2xl font-semibold text-white">
              Chọn màn trước khi thi đấu
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Hệ thống có sẵn 50 màn. Mỗi màn có phần thưởng tiền và EXP tăng dần theo độ khó.
            </p>
          </div>

          <div className="rounded-2xl border border-[#24306e] bg-black/20 px-4 py-3 text-sm text-slate-300">
            Màn đang chọn: <span className="font-semibold text-[#f6d87a]">{selected.level}</span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {levels.map((item) => {
            const active = item.level === selected.level
            return (
              <button
                key={item.level}
                type="button"
                onClick={() => setSelectedLevel(item.level)}
                className={`rounded-2xl border px-4 py-4 text-left transition ${
                  active
                    ? 'border-[#4169ff] bg-[#000080] text-white shadow-[0_16px_30px_-20px_rgba(0,0,128,0.95)]'
                    : 'border-[#24306e] bg-black/20 text-slate-300 hover:border-[#4169ff] hover:bg-white/5 hover:text-white'
                }`}
              >
                <p className="text-xs uppercase tracking-[0.14em] opacity-80">Màn {item.level}</p>
                <p className="mt-2 text-sm font-semibold">{item.rewardMoney.toLocaleString()} tiền</p>
                <p className="mt-1 text-sm">+ {item.rewardExp} EXP / cầu thủ</p>
              </button>
            )
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-[#24306e] bg-black/20 p-4">
          <p className="text-sm text-slate-300">
            Khi bấm <span className="font-semibold text-white">Thi đấu</span>, hệ thống mới mở màn hình trận đấu cho màn đã chọn.
          </p>
          <button
            type="button"
            onClick={() => setIsFighting(true)}
            className="mt-4 w-full rounded-xl bg-[#000080] px-4 py-3 font-semibold text-white transition hover:bg-[#1111a8]"
          >
            Thi đấu màn {selected.level}
          </button>
        </div>
      </article>
    </section>
  )
}

export default AiMatchPage