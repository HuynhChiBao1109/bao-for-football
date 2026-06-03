import { useEffect, useMemo, useState } from 'react';
import { useCampainMatches, useCreateCompainNormal } from '../hooks/useAiCampaign';
import { Banner } from '../components/feedback';
import { useSession } from '../hooks/useSession';
import type { CampaignMatch } from '../types';

export function AiMatchPage() {
  const { data: sessionData } = useSession();
  const teamId = Number(((sessionData?.team as any)?.id ?? 0) as number);
  const {
    data: matches = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCampainMatches(teamId);
  const createCompainNormal = useCreateCompainNormal();

  const [bootstrapping, setBootstrapping] = useState(false);
  const [createError, setCreateError] = useState('');
  const [initAttempted, setInitAttempted] = useState(false);

  useEffect(() => {
    setInitAttempted(false);
    setCreateError('');
  }, [teamId]);

  useEffect(() => {
    if (!teamId || isLoading || isFetching || initAttempted || matches.length > 0) {
      return;
    }

    setInitAttempted(true);
    setBootstrapping(true);
    setCreateError('');

    (async () => {
      try {
        await createCompainNormal.mutateAsync({ teamId });
        await refetch();
      } catch (err) {
        setCreateError((err as Error).message);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [
    createCompainNormal,
    initAttempted,
    isFetching,
    isLoading,
    matches.length,
    refetch,
    teamId,
  ]);

  const totalReward = useMemo(
    () =>
      matches.reduce((sum, item) => {
        const value = Number(item.matchReward ?? 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [matches],
  );

  if (!teamId) {
    return (
      <p className="game-notice game-notice--muted">
        Chua xac dinh duoc team hien tai. Vui long tao doi bong truoc.
      </p>
    );
  }

  if (isLoading || bootstrapping) {
    return (
      <section className="space-y-4">
        <article className="game-panel game-panel--accent p-5 sm:p-6">
          <div className="game-panel__content">
            <p className="game-header-kicker">Campaign AI</p>
            <h2 className="game-title mt-3 text-3xl font-bold text-white">Dang khoi tao campaign</h2>
            <p className="game-copy mt-3">
              He thong dang tai du lieu tran dau. Neu chua co match, backend se tu tao campaign normal.
            </p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <article className="game-panel game-panel--accent overflow-hidden p-5 sm:p-6">
        <div className="game-panel__content">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="game-header-kicker">Campaign AI</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">
                Danh sach tran campaign cua doi ban
              </h2>
              <p className="game-copy mt-3 max-w-2xl text-base">
                Khi vao Campaign, he thong lay danh sach match theo team. Neu chua co se tu dong tao campaign normal,
                sau do render theo du lieu moi nhat.
              </p>
            </div>
            <div className="game-chip">
              So tran: <span className="font-semibold text-emerald-300">{matches.length}</span>
            </div>
          </div>

          {error && <Banner text={(error as Error).message} tone="error" />}
          {createError && <Banner text={createError} tone="error" />}

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="game-stat-card">
              <p className="game-stat-card__label">Tong so tran</p>
              <p className="game-stat-card__value">{matches.length}</p>
            </div>
            <div className="game-stat-card">
              <p className="game-stat-card__label">Tong reward</p>
              <p className="game-stat-card__value">{totalReward.toLocaleString()}</p>
            </div>
            <div className="game-stat-card">
              <p className="game-stat-card__label">Loai campaign</p>
              <p className="game-stat-card__value">NORMAL</p>
            </div>
            <div className="game-stat-card">
              <p className="game-stat-card__label">Trang thai</p>
              <p className="game-stat-card__value">San sang</p>
            </div>
          </div>

          {matches.length === 0 ? (
            <p className="game-notice game-notice--muted mt-5">Chua co tran nao trong campaign.</p>
          ) : (
            <div className="campaign-match-grid mt-5">
              {matches.map((item) => (
                <CampaignMatchCard key={String(item.id)} match={item} />
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function CampaignMatchCard({ match }: { match: CampaignMatch }) {
  const reward = Number(match.matchReward ?? 0);
  const clubName = match.competitorClub?.name || `Club #${String(match.competitorClubId ?? '-')}`;

  return (
    <article className="campaign-match-card">
      <p className="campaign-match-card__stage">Match {Number(match.level ?? 0)}</p>
      <p className="campaign-match-card__club" title={clubName}>
        {clubName}
      </p>
      <div className="campaign-match-card__meta">
        <span>Reward</span>
        <strong>{reward.toLocaleString()}</strong>
      </div>
    </article>
  );
}
