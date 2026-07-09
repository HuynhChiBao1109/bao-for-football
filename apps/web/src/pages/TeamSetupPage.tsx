import { useMemo, useState } from 'react';
import {
  useCreateTeamByClubMutation,
  useReferenceAllLeagues,
  useReferenceClubPlayers,
  useReferenceClubs,
} from '../hooks/useReference';
import { resolveClubImage } from '../lib/referenceImage';
import type { Club, ClubPlayerPreview } from '../types';

function playerOverall(player: ClubPlayerPreview): number {
  const values = [
    player.pass,
    player.longPass,
    player.vision,
    player.shoot,
    player.tackle,
    player.balance,
    player.dribbling,
    player.acceleration,
    player.speed,
    player.stamina,
  ].map((value) => Number(value ?? 0));

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function playerRole(player: ClubPlayerPreview): string {
  return player.positions?.[0]?.position || 'ANY';
}

function statAverage(players: ClubPlayerPreview[], keys: Array<keyof ClubPlayerPreview>): number {
  if (!players.length) return 0;
  const total = players.reduce(
    (sum, player) =>
      sum + keys.reduce((inner, key) => inner + Number(player[key] ?? 0), 0) / keys.length,
    0,
  );
  return Math.round(total / players.length);
}

export function TeamSetupPage() {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [reviewClubId, setReviewClubId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const leaguesQuery = useReferenceAllLeagues(true);
  const clubsQuery = useReferenceClubs(selectedLeagueId, true);
  const reviewPlayersQuery = useReferenceClubPlayers(reviewClubId, Boolean(reviewClubId));
  const createTeamMutation = useCreateTeamByClubMutation();

  const selectedLeague = useMemo(
    () => (leaguesQuery.data ?? []).find((item) => item.id === selectedLeagueId) ?? null,
    [leaguesQuery.data, selectedLeagueId],
  );

  const selectedClub = useMemo(
    () => (clubsQuery.data ?? []).find((item) => item.id === selectedClubId) ?? null,
    [clubsQuery.data, selectedClubId],
  );

  const reviewClub = useMemo(
    () => (clubsQuery.data ?? []).find((item) => item.id === reviewClubId) ?? selectedClub ?? null,
    [clubsQuery.data, reviewClubId, selectedClub],
  );

  const reviewPlayers = reviewPlayersQuery.data ?? [];

  function chooseLeague(leagueId: number) {
    setSelectedLeagueId(leagueId);
    setSelectedClubId(null);
    setReviewClubId(null);
    setError('');
  }

  function openReview(club: Club) {
    setSelectedClubId(club.id);
    setReviewClubId(club.id);
    setError('');
  }

  async function confirmCreateTeam() {
    if (!reviewClubId) {
      setError('Vui long xem detail doi truoc khi confirm.');
      return;
    }

    setError('');
    try {
      await createTeamMutation.mutateAsync({ clubId: reviewClubId });
      window.location.reload();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="team-setup-page team-setup-page--redlock">
      <header className="team-setup-page__hero game-panel game-panel--accent scan-line p-5 sm:p-7">
        <div className="game-panel__content">
          <p className="game-header-kicker">RedLock Entry Draft</p>
          <h1 className="game-title mt-3 text-3xl font-bold text-white sm:text-4xl">
            Chon doi khoi dau
          </h1>
          <p className="game-copy mt-3 max-w-3xl text-base sm:text-lg">
            Chon giai dau, xem detail doi hinh, roi confirm doi se buoc vao RedLock cung ban.
          </p>
        </div>
      </header>

      <div className="team-setup-grid team-setup-grid--draft mt-5">
        <article className="game-panel game-panel--soft p-5 sm:p-6">
          <div className="game-panel__content">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="game-header-kicker">Step 01</p>
                <h2 className="team-setup-section-title mt-2">Chon giai dau</h2>
              </div>
              <span className="game-chip">{(leaguesQuery.data ?? []).length} leagues</span>
            </div>

            {leaguesQuery.isLoading ? (
              <p className="game-notice game-notice--info mt-4">Dang tai danh sach giai dau...</p>
            ) : null}

            <div className="team-league-list game-scroll mt-4">
              {(leaguesQuery.data ?? []).map((league) => (
                <button
                  key={league.id}
                  type="button"
                  className="team-league-card"
                  data-active={league.id === selectedLeagueId}
                  onClick={() => chooseLeague(league.id)}
                >
                  <span>{league.name}</span>
                  <small>{league.country?.name ?? 'Academy League'}</small>
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="game-panel game-panel--accent p-5 sm:p-6">
          <div className="game-panel__content">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="game-header-kicker">Step 02</p>
                <h2 className="team-setup-section-title mt-2">Chon doi</h2>
              </div>
              <span className="game-chip">{selectedLeague?.name ?? 'No league selected'}</span>
            </div>

            {!selectedLeagueId ? (
              <p className="game-notice game-notice--muted mt-4">Hay chon giai dau truoc.</p>
            ) : clubsQuery.isLoading ? (
              <p className="game-notice game-notice--info mt-4">Dang tai danh sach doi...</p>
            ) : (
              <div className="team-club-list team-club-list--draft mt-4 game-scroll">
                {(clubsQuery.data ?? []).map((club) => (
                  <article
                    key={club.id}
                    className="team-club-card team-club-card--draft"
                    data-active={club.id === selectedClubId}
                  >
                    <button type="button" onClick={() => openReview(club)} aria-label={club.name}>
                      <img
                        src={resolveClubImage(club)}
                        alt={club.name}
                        className="h-12 w-12 rounded-lg border border-white/10 bg-white/5 object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="team-club-card__content">
                        <span className="team-club-card__name">{club.name}</span>
                        <span className="team-club-card__league">{selectedLeague?.name ?? 'League'}</span>
                      </span>
                    </button>
                    <button type="button" className="game-button-secondary" onClick={() => openReview(club)}>
                      Detail
                    </button>
                  </article>
                ))}

                {(clubsQuery.data ?? []).length === 0 ? (
                  <p className="game-notice game-notice--muted">Khong co doi nao trong giai dau nay.</p>
                ) : null}
              </div>
            )}

            {error ? <p className="game-notice game-notice--error mt-4">{error}</p> : null}
          </div>
        </article>
      </div>

      {reviewClub ? (
        <TeamReviewModal
          club={reviewClub}
          players={reviewPlayers}
          loading={reviewPlayersQuery.isLoading}
          error={reviewPlayersQuery.error as Error | null}
          confirming={createTeamMutation.isPending}
          onClose={() => setReviewClubId(null)}
          onConfirm={() => void confirmCreateTeam()}
        />
      ) : null}
    </section>
  );
}

function TeamReviewModal({
  club,
  players,
  loading,
  error,
  confirming,
  onClose,
  onConfirm,
}: {
  club: Club;
  players: ClubPlayerPreview[];
  loading: boolean;
  error?: Error | null;
  confirming: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const sortedPlayers = [...players].sort((a, b) => playerOverall(b) - playerOverall(a));
  const attack = statAverage(players, ['shoot', 'dribbling', 'speed', 'acceleration']);
  const buildUp = statAverage(players, ['pass', 'longPass', 'vision']);
  const defense = statAverage(players, ['tackle', 'stamina', 'balance']);

  return (
    <div className="game-modal-backdrop team-review-backdrop" role="dialog" aria-modal="true">
      <section className="team-review-modal game-panel game-panel--accent game-scroll">
        <div className="game-panel__content">
          <header className="team-review-modal__head">
            <div className="team-review-modal__club">
              <img
                src={resolveClubImage(club)}
                alt={club.name}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <p className="game-header-kicker">Team Detail</p>
                <h2 className="game-title">{club.name}</h2>
              </div>
            </div>
            <button type="button" className="game-button-ghost" onClick={onClose}>
              Close
            </button>
          </header>

          {loading ? <p className="game-notice game-notice--info mt-4">Dang scan doi hinh...</p> : null}
          {error ? <p className="game-notice game-notice--error mt-4">{error.message}</p> : null}

          <div className="team-review-summary mt-5">
            <ReviewStat label="Attack" value={attack} />
            <ReviewStat label="Build Up" value={buildUp} />
            <ReviewStat label="Defense" value={defense} />
            <ReviewStat label="Players" value={players.length} />
          </div>

          <div className="team-review-roster mt-5">
            {sortedPlayers.map((player) => (
              <article key={player.id} className="team-review-player">
                <span>{playerRole(player)}</span>
                <strong>{player.name}</strong>
                <small>OVR {playerOverall(player)}</small>
              </article>
            ))}
          </div>

          <button
            type="button"
            className="game-button-primary mt-5 w-full"
            onClick={onConfirm}
            disabled={confirming || loading || players.length === 0}
          >
            {confirming ? 'Dang confirm...' : `Confirm ${club.name}`}
          </button>
        </div>
      </section>
    </div>
  );
}

function ReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="game-stat-card">
      <p className="game-stat-card__label">{label}</p>
      <p className="game-stat-card__value">{value}</p>
    </div>
  );
}
