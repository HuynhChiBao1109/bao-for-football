import { useEffect, useMemo, useState } from 'react';
import { useCampainMatches, useCreateCompainNormal } from '../hooks/useAiCampaign';
import { Banner } from '../components/feedback';
import { StatusBadge } from '../components/redlock/RedLockUI';
import { useSession } from '../hooks/useSession';
import type { CampaignMatch } from '../types';
import { TacticsPopup } from './TacticsPage';

export function AiMatchPage() {
  const { data: sessionData } = useSession();
  const teamId = Number(((sessionData?.team as any)?.id ?? 0) as number);
  const { data: matches = [], isLoading, isFetching, error, refetch } = useCampainMatches(teamId);
  const createCompainNormal = useCreateCompainNormal();

  const [bootstrapping, setBootstrapping] = useState(false);
  const [createError, setCreateError] = useState('');
  const [initAttempted, setInitAttempted] = useState(false);
  const [selectedCampaignMatchId, setSelectedCampaignMatchId] = useState<string>('');

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
  }, [createCompainNormal, initAttempted, isFetching, isLoading, matches.length, refetch, teamId]);

  const totalReward = useMemo(
    () =>
      matches.reduce((sum, item) => {
        const value = Number(item.matchReward ?? 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [matches],
  );
  const campaignLevel = useMemo(
    () =>
      matches.reduce((max, item) => {
        const value = Number(item.campainLevel ?? item.campain?.level ?? 1);
        return Number.isFinite(value) ? Math.max(max, value) : max;
      }, 1),
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
            <h2 className="game-title mt-3 text-3xl font-bold text-white">
              Dang khoi tao campaign
            </h2>
            <p className="game-copy mt-3">Dang dong bo du lieu match.</p>
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
              <p className="game-header-kicker">RedLock Campaign</p>
              <h2 className="game-title mt-3 text-3xl font-bold text-white">Start Match</h2>
              <p className="game-copy mt-2 max-w-2xl">
                Review your saved lineup, then enter the next academy battle.
              </p>
            </div>
            <div className="game-chip">
              Matches: <span className="font-semibold text-red-200">{matches.length}</span>
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
              <p className="game-stat-card__value">Level {campaignLevel}</p>
            </div>
          </div>

          {matches.length === 0 ? (
            <p className="game-notice game-notice--muted mt-5">Chua co tran nao trong campaign.</p>
          ) : (
            <div className="campaign-match-grid mt-5">
              {matches.map((item) => (
                <CampaignMatchCard
                  key={String(item.id)}
                  match={item}
                  campaignLevel={campaignLevel}
                  onStart={async () => {
                    setSelectedCampaignMatchId(String(item.id));
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </article>
      {selectedCampaignMatchId && (
        <TacticsPopup
          campaignMatchId={selectedCampaignMatchId}
          onClose={() => setSelectedCampaignMatchId('')}
        />
      )}
    </section>
  );
}

function CampaignMatchCard({
  match,
  campaignLevel,
  onStart,
  isStarting,
}: {
  match: CampaignMatch;
  campaignLevel: number;
  onStart: () => Promise<void>;
  isStarting?: boolean;
}) {
  const reward = Number(match.matchReward ?? 0);
  const clubName = match.competitor?.name || `BOT #${String(match.competitorId ?? '-')}`;
  const level = Number(match.level ?? 0);
  const isCleared = level < campaignLevel;
  const isUnlocked = level <= campaignLevel;
  const isLocked = !isUnlocked;

  return (
    <article className="campaign-match-card" data-locked={isLocked} data-cleared={isCleared}>
      <p className="campaign-match-card__stage">
        Match {level}
      </p>
      <div className="mt-2">
        <StatusBadge tone={isLocked ? 'muted' : isCleared ? 'warning' : 'red'}>
          {isCleared ? 'Cleared' : isLocked ? 'Locked' : 'Unlocked'}
        </StatusBadge>
      </div>
      <p className="campaign-match-card__club" title={clubName}>
        {clubName}
      </p>
      <div className="campaign-match-card__meta">
        <span>Reward</span>
        <strong>{reward.toLocaleString()}</strong>
      </div>
      <button
        type="button"
        className="game-button-primary mt-3 w-full"
        disabled={isStarting || isLocked}
        title={isLocked ? `Mo khoa sau khi hoan thanh level ${level - 1}` : undefined}
        onClick={() => {
          if (isLocked) {
            return;
          }
          void onStart();
        }}
      >
        {isLocked
          ? 'Locked'
          : isCleared
            ? 'Replay Match'
            : isStarting
              ? 'Starting...'
              : 'Start Match'}
      </button>
    </article>
  );
}
