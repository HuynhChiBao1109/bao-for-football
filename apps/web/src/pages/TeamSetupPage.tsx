import { useEffect, useMemo, useState } from 'react';
import {
  useReferenceClubs,
  useReferenceCountries,
  useReferenceLeagues,
  useCreateTeamByClubMutation,
} from '../hooks/useReference';
import { resolveClubImage, resolveCountryImage } from '../lib/referenceImage';

export function TeamSetupPage() {
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const countriesQuery = useReferenceCountries(true);
  const leaguesQuery = useReferenceLeagues(selectedCountryId, true);
  const clubsQuery = useReferenceClubs(selectedLeagueId, true);
  const createTeamMutation = useCreateTeamByClubMutation();

  useEffect(() => {
    setSelectedLeagueId(null);
    setSelectedClubId(null);
  }, [selectedCountryId]);

  useEffect(() => {
    setSelectedClubId(null);
  }, [selectedLeagueId]);

  const selectedCountry = useMemo(
    () => (countriesQuery.data ?? []).find((item) => item.id === selectedCountryId) ?? null,
    [countriesQuery.data, selectedCountryId],
  );

  const selectedLeague = useMemo(
    () => (leaguesQuery.data ?? []).find((item) => item.id === selectedLeagueId) ?? null,
    [leaguesQuery.data, selectedLeagueId],
  );

  const selectedClub = useMemo(
    () => (clubsQuery.data ?? []).find((item) => item.id === selectedClubId) ?? null,
    [clubsQuery.data, selectedClubId],
  );

  async function confirmCreateTeam() {
    if (!selectedCountryId || !selectedLeagueId || !selectedClubId) {
      setError('Vui long chon day du Quoc gia, Giai dau va CLB.');
      return;
    }

    setError('');
    try {
      await createTeamMutation.mutateAsync({ clubId: selectedClubId });
      window.location.reload();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="team-setup-page">
      <header className="team-setup-page__hero game-panel game-panel--accent scan-line p-5 sm:p-7">
        <div className="game-panel__content">
          <p className="game-header-kicker">Start Squad</p>
          <h1 className="game-title mt-3 text-3xl font-bold text-white sm:text-4xl">
            Chon CLB khoi dau
          </h1>
          <p className="game-copy mt-3 max-w-3xl text-base sm:text-lg">
            Quoc gia {'->'} Giai dau {'->'} CLB.
          </p>
        </div>
      </header>

      <div className="team-setup-grid mt-5">
        <article className="game-panel game-panel--soft p-5 sm:p-6">
          <div className="game-panel__content space-y-4">
            <h2 className="team-setup-section-title">1. Quoc gia</h2>
            <select
              className="game-select"
              value={selectedCountryId ?? ''}
              onChange={(event) =>
                setSelectedCountryId(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Chon quoc gia</option>
              {(countriesQuery.data ?? []).map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>

            <h2 className="team-setup-section-title mt-2">2. Giai dau</h2>
            <select
              className="game-select"
              value={selectedLeagueId ?? ''}
              onChange={(event) =>
                setSelectedLeagueId(event.target.value ? Number(event.target.value) : null)
              }
              disabled={!selectedCountryId}
            >
              <option value="">Chon giai dau</option>
              {(leaguesQuery.data ?? []).map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>

            <div className="game-stat-card mt-2">
              <p className="game-stat-card__label">Preview</p>
              <div className="mt-3 flex items-center gap-3">
                <img
                  src={resolveCountryImage(selectedCountry)}
                  alt={selectedCountry?.name ?? 'Country'}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <img
                  src={resolveClubImage(selectedClub)}
                  alt={selectedClub?.name ?? 'Club'}
                  className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
                <div>
                  <p className="text-sm text-slate-200">
                    Quoc gia: <strong>{selectedCountry?.name ?? 'Chua chon'}</strong>
                  </p>
                  <p className="mt-1 text-sm text-slate-200">
                    Giai dau: <strong>{selectedLeague?.name ?? 'Chua chon'}</strong>
                  </p>
                  <p className="mt-1 text-sm text-slate-200">
                    CLB: <strong>{selectedClub?.name ?? 'Chua chon'}</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article className="game-panel game-panel--accent p-5 sm:p-6">
          <div className="game-panel__content">
            <h2 className="team-setup-section-title">3. CLB</h2>

            {!selectedLeagueId ? (
              <p className="game-notice game-notice--info mt-4">Chon Quoc gia va Giai dau truoc.</p>
            ) : (
              <div className="team-club-list mt-4 game-scroll">
                {(clubsQuery.data ?? []).map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    className="team-club-card"
                    data-active={club.id === selectedClubId}
                    onClick={() => setSelectedClubId(club.id)}
                  >
                    <img
                      src={resolveClubImage(club)}
                      alt={club.name}
                      className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="team-club-card__content">
                      <span className="team-club-card__name">{club.name}</span>
                      <span className="team-club-card__league">
                        {selectedLeague?.name ?? 'League'}
                      </span>
                    </div>
                  </button>
                ))}

                {(clubsQuery.data ?? []).length === 0 && (
                  <p className="game-notice game-notice--muted">
                    Khong co CLB nao trong giai dau nay.
                  </p>
                )}
              </div>
            )}

            {error && <p className="game-notice game-notice--error mt-4">{error}</p>}

            <button
              type="button"
              className="game-button-primary mt-5 w-full"
              onClick={confirmCreateTeam}
              disabled={createTeamMutation.isPending || !selectedClubId}
            >
              {createTeamMutation.isPending ? 'Dang tao doi bong...' : 'Xac nhan tao doi bong'}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
