import { useState, useMemo } from 'react'
import { useAiStages, useSubmitStageResult, useStartMatch, useFinalizeMatch } from '../hooks/useAiCampaign'
import { Banner } from '../components/ui/Banner'
import MatchView from '../MatchView.jsx'
import type { AiStage } from '../types'

export function AiMatchPage() {
  const { data: stages = [], isLoading, error } = useAiStages()
  const submitResult = useSubmitStageResult()
  const startMatch = useStartMatch()
  const finalizeMatch = useFinalizeMatch()

  const [selectedStageNo, setSelectedStageNo] = useState<number>(1)
  const [isFighting, setIsFighting] = useState(false)
  const [activeMatchID, setActiveMatchID] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const [fightError, setFightError] = useState('')

  const selected = useMemo(() => stages.find((s) => s.stageNo === selectedStageNo) ?? null, [stages, selectedStageNo])

  async function handleStartMatch() {
    if (!selected || !selected.isUnlocked || selected.isCleared) return
    setFightError('')
    setResultMessage('')
    try {
      const matchId = await startMatch.mutateAsync({ awayClubName: selected.clubName, mode: 'ai_campaign', stageNo: selected.stageNo })
      setActiveMatchID(matchId)
      setIsFighting(true)
    } catch (err) {
      setFightError((err as Error).message)
    }
  }

  async function handleMatchEnd(result: { didWin: boolean; home?: number; away?: number; homeStats?: object; awayStats?: object; scorers?: unknown[] }) {
    if (!selected) return
    if (activeMatchID) {
      try {
        await finalizeMatch.mutateAsync({ matchId: activeMatchID, homeScore: Number(result?.home ?? 0), awayScore: Number(result?.away ?? 0), homeStats: result?.homeStats, awayStats: result?.awayStats, scorers: Array.isArray(result?.scorers) ? result.scorers : [] })
      } catch (err) {
        setFightError(`Không lưu được lịch sử trận: ${(err as Error).message}`)
      }
    }

    try {
      const data = await submitResult.mutateAsync({ stageNo: selected.stageNo, isWin: Boolean(result?.didWin) }) as { grantedMoney?: number; grantedExpPerPlayer?: number; rewardedPlayers?: number; unlockedNext?: boolean; nextUnlockedStage?: number } | undefined

      if (result?.didWin) {
        const rewardText = `${Number(data?.grantedMoney ?? 0).toLocaleString()} tiền + ${Number(data?.grantedExpPerPlayer ?? 0)} EXP x ${Number(data?.rewardedPlayers ?? 0)} cầu thủ`
        if (data?.unlockedNext) {
          setResultMessage(`Thắng màn ${selected.stageNo}. Nhận ${rewardText}. Đã mở khóa màn ${data.nextUnlockedStage}.`)
        } else {
          setResultMessage(`Thắng màn ${selected.stageNo}. Nhận ${rewardText}.`)
        }
      } else {
        setResultMessage(`Bạn đã thua màn ${selected.stageNo}. Hãy thử lại.`)
      }
    } catch (err) {
      setFightError((err as Error).message)
    }

    setIsFighting(false)
    setActiveMatchID('')
  }

  if (isLoading) return <p className="game-notice game-notice--info">Đang tải danh sách 50 màn...</p>
  if (!selected && !isLoading) return <p className="game-notice game-notice--muted">Chưa có dữ liệu màn AI.</p>

  if (isFighting && selected) {
    return (
      <section className="space-y-4">
        <div className="game-panel game-panel--accent overflow-hidden p-4 sm:p-5">
          <div className="game-panel__content flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="game-header-kicker">Campaign Battle</p>
              <h2 className="game-title mt-2 text-3xl font-bold text-white">Màn {selected.stageNo}</h2>
              <p className="mt-2 text-sm text-slate-300">Đối thủ: {selected.clubName} · Buff +{selected.enemyStatBonus}</p>
            </div>
            <button type="button" onClick={() => { setIsFighting(false); setActiveMatchID('') }} className="game-button-secondary">Quay lại chọn màn</button>
          </div>
        </div>
        <MatchView embedded onMatchEnd={handleMatchEnd} matchId={activeMatchID} />
        {fightError && <Banner text={fightError} tone="error" />}
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">AI Campaign</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">50 màn campaign theo tiến trình thắng-thua</h2>
              <p className="game-copy mt-3 max-w-2xl text-base">Phải thắng màn hiện tại mới mở màn tiếp theo. Mỗi màn có đối thủ CLB random và đội hình 22 cầu thủ với chỉ số tăng dần.</p>
            </div>
            <div className="game-chip">Màn: <span className="font-semibold text-emerald-300">{selectedStageNo}</span></div>
          </div>

          {error && <Banner text={(error as Error).message} tone="error" />}
          {fightError && <Banner text={fightError} tone="error" />}
          {resultMessage && <Banner text={resultMessage} tone="success" />}

          <button
            type="button"
            disabled={!selected || !selected.isUnlocked || selected.isCleared || startMatch.isPending}
            onClick={handleStartMatch}
            className="game-button-primary mt-4 w-full disabled:border-slate-700/70 disabled:bg-slate-900/50 disabled:text-slate-400"
          >
            {startMatch.isPending ? 'Đang tạo trận...' : selected?.isCleared ? `Màn ${selectedStageNo} đã hoàn thành` : `Vào thi đấu màn ${selectedStageNo}`}
          </button>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((item) => (
              <StageButton key={item.stageNo} stage={item} active={item.stageNo === selectedStageNo} onClick={() => setSelectedStageNo(item.stageNo)} />
            ))}
          </div>
        </div>
      </article>
    </section>
  )
}

function StageButton({ stage, active, onClick }: { stage: AiStage; active: boolean; onClick: () => void }) {
  const locked = !stage.isUnlocked
  const completed = stage.isCleared
  return (
    <button
      type="button"
      onClick={!locked ? onClick : undefined}
      disabled={locked}
      data-active={active}
      className={`rounded-[18px] border px-3 py-3 text-left text-sm transition ${
        active ? 'border-emerald-400/60 bg-emerald-400/10' :
        completed ? 'border-white/8 bg-black/20 text-slate-400' :
        locked ? 'border-white/4 bg-black/10 text-slate-600 cursor-not-allowed' :
        'border-white/8 bg-black/20 hover:border-white/20'
      }`}
    >
      <p className="font-semibold text-white">Màn {stage.stageNo}</p>
      <p className="mt-1 text-xs text-slate-400 truncate">{stage.clubName}</p>
      <p className="mt-1 text-xs">{completed ? '✓ Hoàn thành' : locked ? '🔒 Khóa' : '▶ Khả dụng'}</p>
    </button>
  )
}
