import { Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useSession } from '../hooks/useSession'
import { useClubs } from '../hooks/useClubs'
import { ROUTES } from '../routes'
import { queryClient } from '../lib/queryClient'
import { apiClient } from '../lib/apiClient'

export function AppLayout() {
  const { session, isAdmin } = useAuth()
  const { data: sessionData } = useSession()
  const { data: clubs = [], isLoading: clubsLoading } = useClubs()
  const navigate = useNavigate()
  const [selectedStarterClubId, setSelectedStarterClubId] = useState<number>(0)
  const [assigningClub, setAssigningClub] = useState(false)
  const [assignClubError, setAssignClubError] = useState('')

  const needsStarterClub = Boolean(session && !isAdmin && !sessionData?.team)

  useEffect(() => {
    if (!needsStarterClub) {
      setAssignClubError('')
      return
    }
    if (selectedStarterClubId > 0) {
      return
    }
    if (clubs.length > 0) {
      setSelectedStarterClubId(clubs[0].id)
    }
  }, [needsStarterClub, clubs, selectedStarterClubId])

  const selectedStarterClub = useMemo(
    () => clubs.find((club) => club.id === selectedStarterClubId) ?? clubs[0] ?? null,
    [clubs, selectedStarterClubId],
  )

  async function handleCreateStarterTeam() {
    if (!session?.token || !selectedStarterClub) {
      return
    }

    setAssigningClub(true)
    setAssignClubError('')
    try {
      await apiClient('/api/v1/auth/team', {
        method: 'POST',
        token: session.token,
        body: { clubId: selectedStarterClub.id },
      })

      await queryClient.invalidateQueries({ queryKey: ['session', session.token] })
      navigate(ROUTES.club, { replace: true })
    } catch (err) {
      setAssignClubError((err as Error).message)
    } finally {
      setAssigningClub(false)
    }
  }

  return (
    <main className="app-shell">
      <div className="app-shell__inner space-y-6">
        <Outlet />

        {needsStarterClub && (
          <div className="game-modal-backdrop">
            <section className="game-panel game-panel--accent game-modal-card p-5 sm:p-6">
              <div className="game-panel__content">
                <p className="game-header-kicker">Starter Team Setup</p>
                <h2 className="game-title mt-3 text-2xl font-bold text-white sm:text-3xl">
                  Chọn câu lạc bộ trước khi bắt đầu
                </h2>
                <p className="game-copy mt-2 text-sm sm:text-base">
                  Tài khoản của bạn chưa có team. Chọn CLB khởi đầu, review thông tin và tạo team.
                </p>

                <label className="mt-4 block">
                  <span className="game-field-label">Câu lạc bộ khởi đầu</span>
                  <select
                    value={selectedStarterClub?.id ?? 0}
                    onChange={(event) => setSelectedStarterClubId(Number(event.target.value))}
                    className="game-select"
                    disabled={assigningClub || clubsLoading || clubs.length === 0}
                  >
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedStarterClub && (
                  <div className="game-stat-card mt-4">
                    <p className="game-stat-card__label">Review đội khởi đầu</p>
                    <div className="mt-3 flex items-center gap-3">
                      <img
                        src={selectedStarterClub.logo ?? '/default-avatar.svg'}
                        alt={selectedStarterClub.name}
                        className="h-14 w-14 rounded-2xl bg-white/10 object-contain p-1.5"
                      />
                      <div>
                        <p className="font-semibold text-white">{selectedStarterClub.name}</p>
                        <p className="text-xs text-slate-400">{selectedStarterClub.leagueName || 'Unknown league'}</p>
                        <p className="text-xs text-emerald-300">
                          Budget khởi đầu: {Number(selectedStarterClub.budget ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {assignClubError && <p className="game-notice game-notice--error mt-4">{assignClubError}</p>}

                <button
                  type="button"
                  onClick={handleCreateStarterTeam}
                  disabled={!selectedStarterClub || assigningClub || clubsLoading}
                  className="game-button-primary mt-5 w-full"
                >
                  {assigningClub ? 'Đang tạo team...' : 'Bắt đầu tạo team'}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
