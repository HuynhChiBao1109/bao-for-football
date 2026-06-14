import { startTransition, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banner } from '../components/feedback';
import { MatchMode } from '../enums/match';
import { useCampainMatches, useCreateCompainNormal } from '../hooks/useAiCampaign';
import { useAuth } from '../hooks/useAuth';
import { usePlayerCards } from '../hooks/usePlayerCards';
import { useSession } from '../hooks/useSession';
import { useStartCampaignMatch } from '../hooks/useMatch';
import { useSaveTactics, useTactics } from '../hooks/useTactics';
import { queryClient } from '../lib/queryClient';
import { matchLivePath, ROUTES } from '../routes';
import type { CampaignMatch, Tactics, UserPlayerCard } from '../types';
import './ClubPage.css';

type DockAction = {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: 'cyan' | 'gold' | 'red';
};

type ClubModal = 'campaign' | 'lineup' | null;
type LineupSlot = {
  slotId: string;
  role: string;
  label: string;
  x: number;
  y: number;
};

const DEFAULT_TACTICS: Tactics = {
  formation: '4-3-3',
  passRatio: 58,
  shotRatio: 42,
  pressure: 61,
  mode: MatchMode.Casual,
  lineup: [],
  gameplay: {
    passSpeedScale: 1.05,
    interceptionRadius: 1.02,
    gkBuildUpBias: 1,
    tempoScale: 1.05,
  },
};

const FORMATION_SLOTS: Record<string, LineupSlot[]> = {
  '4-3-3': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lcm', role: 'CM', label: 'CM', x: 30, y: 57 },
    { slotId: 'cm', role: 'CM', label: 'CM', x: 50, y: 55 },
    { slotId: 'rcm', role: 'CM', label: 'CM', x: 70, y: 57 },
    { slotId: 'lw', role: 'LW', label: 'LW', x: 20, y: 30 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 24 },
    { slotId: 'rw', role: 'RW', label: 'RW', x: 80, y: 30 },
  ],
  '4-4-2': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 18, y: 55 },
    { slotId: 'lcm', role: 'CM', label: 'CM', x: 40, y: 56 },
    { slotId: 'rcm', role: 'CM', label: 'CM', x: 60, y: 56 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 82, y: 55 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 42, y: 26 },
    { slotId: 'st2', role: 'ST', label: 'ST', x: 58, y: 26 },
  ],
};

export function ClubPage() {
  const { data: sessionData, isLoading } = useSession();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [notice, setNotice] = useState('');
  const [activeModal, setActiveModal] = useState<ClubModal>(null);

  const team = sessionData?.team ?? null;
  const userName = sessionData?.user?.userName || 'Player';

  function handleLogout() {
    setSession(null);
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  }

  const leftActions: DockAction[] = [
    { label: 'Events', icon: <CalendarIcon />, onClick: () => setNotice('Events dang cap nhat.') },
    { label: 'Shop', icon: <ShopIcon />, onClick: () => setNotice('Shop dang cap nhat.'), tone: 'gold' },
    { label: 'Lineup', icon: <FormationIcon />, onClick: () => navigate(ROUTES.tactics), tone: 'red' },
  ];
  const rightActions: DockAction[] = [
    { label: 'Players', icon: <PlayersIcon />, onClick: () => navigate(ROUTES.players) },
    { label: 'Gacha', icon: <SparkIcon />, onClick: () => navigate(ROUTES.gacha), tone: 'gold' },
  ];
  const quickActions: DockAction[] = [
    { label: 'Campaign', icon: <WhistleIcon />, onClick: () => setActiveModal('campaign'), tone: 'gold' },
    { label: 'PvP', icon: <VersusIcon />, onClick: () => navigate(ROUTES.pvp), tone: 'red' },
    { label: 'Lineup', icon: <FormationIcon />, onClick: () => setActiveModal('lineup') },
    { label: 'Shop', icon: <ShopIcon />, onClick: () => setNotice('Shop dang cap nhat.'), tone: 'gold' },
  ];

  if (isLoading) {
    return (
      <section className="club-dashboard club-dashboard--loading">
        <div className="club-dashboard__loader" />
      </section>
    );
  }

  if (!team) {
    return (
      <section className="club-dashboard club-dashboard--empty">
        <Banner text="Chua co team. Hay chon CLB khoi dau de vao game." tone="muted" />
      </section>
    );
  }

  return (
    <section className="club-dashboard">
      <div className="club-dashboard__field" aria-hidden="true" />
      <div className="club-dashboard__player" aria-hidden="true" />
      <div className="club-dashboard__scan" aria-hidden="true" />

      <header className="club-dashboard__top">
        <button
          type="button"
          className="club-icon-button club-icon-button--user"
          onClick={() => navigate(ROUTES.players)}
          aria-label="Players"
          title="Players"
        >
          <img src={team.imgUrl || '/app/logo.png'} alt="" />
        </button>
        <button
          type="button"
          className="club-icon-button club-icon-button--small"
          onClick={handleLogout}
          aria-label="Logout"
          title="Logout"
        >
          <PowerIcon />
        </button>
      </header>

      <div className="club-dashboard__identity">
        <p>{userName}</p>
        <strong>{team.teamName}</strong>
      </div>

      <nav className="club-dashboard__quick" aria-label="Club actions">
        {quickActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-action-card"
            data-tone={action.tone ?? 'cyan'}
            style={{ animationDelay: `${index * 70}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span className="club-action-card__icon">{action.icon}</span>
            <span className="club-action-card__label">{action.label}</span>
          </button>
        ))}
      </nav>

      <nav className="club-dashboard__side club-dashboard__side--left" aria-label="Events and shop">
        {leftActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-orbit-button"
            data-tone={action.tone ?? 'cyan'}
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span>{action.icon}</span>
          </button>
        ))}
      </nav>

      <nav className="club-dashboard__side club-dashboard__side--right" aria-label="Gacha">
        {rightActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-orbit-button"
            data-tone={action.tone ?? 'cyan'}
            style={{ animationDelay: `${index * 90}ms` }}
            onClick={action.onClick}
            aria-label={action.label}
            title={action.label}
          >
            <span>{action.icon}</span>
          </button>
        ))}
      </nav>

      {notice ? (
        <button type="button" className="club-toast" onClick={() => setNotice('')}>
          {notice}
        </button>
      ) : null}

      {activeModal ? (
        <ClubModalShell
          title={activeModal === 'campaign' ? 'Campaign' : 'Lineup'}
          tone={activeModal === 'campaign' ? 'gold' : 'cyan'}
          onClose={() => setActiveModal(null)}
        >
          {activeModal === 'campaign' ? (
            <CampaignPopup teamId={Number(team.id)} />
          ) : (
            <LineupPopup teamId={String(team.id)} />
          )}
        </ClubModalShell>
      ) : null}
    </section>
  );
}

function ClubModalShell({
  title,
  tone,
  onClose,
  children,
}: {
  title: string;
  tone: 'cyan' | 'gold';
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="club-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="club-modal__backdrop" onClick={onClose} aria-label="Close" />
      <section className="club-modal__panel" data-tone={tone}>
        <header className="club-modal__head">
          <div>
            <span>{tone === 'gold' ? 'Season route' : 'Match squad'}</span>
            <strong>{title}</strong>
          </div>
          <button type="button" className="club-modal__close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function CampaignPopup({ teamId }: { teamId: number }) {
  const navigate = useNavigate();
  const { data: matches = [], isLoading, isFetching, error, refetch } = useCampainMatches(teamId);
  const createCampaign = useCreateCompainNormal();
  const startMatch = useStartCampaignMatch();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [initAttempted, setInitAttempted] = useState(false);

  useEffect(() => {
    setInitAttempted(false);
  }, [teamId]);

  useEffect(() => {
    if (!teamId || isLoading || isFetching || initAttempted || matches.length > 0) return;
    setInitAttempted(true);
    setBootstrapping(true);
    createCampaign
      .mutateAsync({ teamId })
      .then(() => refetch())
      .finally(() => setBootstrapping(false));
  }, [createCampaign, initAttempted, isFetching, isLoading, matches.length, refetch, teamId]);

  const totalReward = useMemo(
    () => matches.reduce((sum, item) => sum + Number(item.matchReward ?? 0), 0),
    [matches],
  );

  return (
    <div className="club-popup club-popup--campaign">
      <div className="club-popup__stats">
        <MiniStat label="Matches" value={matches.length} />
        <MiniStat label="Reward" value={totalReward.toLocaleString()} />
        <MiniStat label="Mode" value="Normal" />
      </div>

      {error ? <Banner text={(error as Error).message} tone="error" /> : null}
      {isLoading || bootstrapping ? (
        <div className="club-popup__loading">Dang khoi tao campaign...</div>
      ) : (
        <div className="club-campaign-list">
          {matches.map((match) => (
            <CampaignPopupCard
              key={String(match.id)}
              match={match}
              isStarting={startMatch.isPending}
              onStart={async () => {
                const response = await startMatch.mutateAsync({ campainMatchId: match.id });
                startTransition(() => navigate(matchLivePath(response.matchId)));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignPopupCard({
  match,
  isStarting,
  onStart,
}: {
  match: CampaignMatch;
  isStarting: boolean;
  onStart: () => Promise<void>;
}) {
  const clubName = match.competitor?.name || `BOT #${String(match.competitorId ?? '-')}`;

  return (
    <article className="club-campaign-card">
      <span>Match {Number(match.level ?? 0)}</span>
      <strong>{clubName}</strong>
      <p>{Number(match.matchReward ?? 0).toLocaleString()} reward</p>
      <button type="button" disabled={isStarting} onClick={() => void onStart()}>
        {isStarting ? 'Starting...' : 'Start'}
      </button>
    </article>
  );
}

function LineupPopup({ teamId }: { teamId: string }) {
  const { data: loaded } = useTactics(teamId);
  const { data: cards = [] } = usePlayerCards();
  const saveTactics = useSaveTactics();
  const [formation, setFormation] = useState('4-3-3');
  const [lineup, setLineup] = useState<Record<string, number | null>>({});
  const [selectedSlotId, setSelectedSlotId] = useState('gk');
  const [message, setMessage] = useState('');
  const slots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];

  useEffect(() => {
    if (!loaded) return;
    setFormation(loaded.formation || '4-3-3');
    const next: Record<string, number | null> = {};
    loaded.lineup?.forEach((item) => {
      next[item.slotId] = Number(item.userPlayerId);
    });
    setLineup(next);
  }, [loaded]);

  useEffect(() => {
    setLineup((prev) => {
      const next: Record<string, number | null> = {};
      slots.forEach((slot) => {
        next[slot.slotId] = prev[slot.slotId] ?? null;
      });
      return next;
    });
    setSelectedSlotId((prev) => (slots.some((slot) => slot.slotId === prev) ? prev : slots[0].slotId));
  }, [slots]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.userPlayerId, card])), [cards]);
  const usedIds = useMemo(
    () => new Set(Object.values(lineup).filter(Boolean) as number[]),
    [lineup],
  );
  const selectedSlot = slots.find((slot) => slot.slotId === selectedSlotId) ?? slots[0];
  const availableCards = useMemo(
    () =>
      cards
        .map((card) => ({ card, score: playerOverall(card), fit: positionFit(card, selectedSlot.role) }))
        .sort((a, b) => b.fit - a.fit || b.score - a.score),
    [cards, selectedSlot.role],
  );
  const starterCount = slots.filter((slot) => lineup[slot.slotId]).length;

  function assignPlayer(playerId: number) {
    setLineup((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((slotId) => {
        if (next[slotId] === playerId) next[slotId] = null;
      });
      next[selectedSlotId] = playerId;
      return next;
    });
  }

  function autoFill() {
    const pool = [...cards];
    const next: Record<string, number | null> = {};
    slots.forEach((slot) => {
      let bestIndex = 0;
      let bestScore = -1;
      pool.forEach((card, index) => {
        const score = playerOverall(card) * positionFit(card, slot.role);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      const picked = pool.splice(bestIndex, 1)[0];
      next[slot.slotId] = picked?.userPlayerId ?? null;
    });
    setLineup(next);
  }

  async function saveLineup() {
    const payload = slots
      .map((slot) => ({
        slotId: slot.slotId,
        position: roleToPosition(slot.role),
        userPlayerId: Number(lineup[slot.slotId] ?? 0),
      }))
      .filter((item) => item.userPlayerId > 0);

    await saveTactics.mutateAsync({
      teamId,
      ...(loaded ?? DEFAULT_TACTICS),
      formation,
      lineup: payload,
    });
    setMessage('Đã lưu đội hình chính.');
  }

  return (
    <div className="club-popup club-popup--lineup">
      <div className="club-lineup-toolbar">
        <div className="club-segment">
          {Object.keys(FORMATION_SLOTS).map((item) => (
            <button
              key={item}
              type="button"
              data-active={formation === item}
              onClick={() => setFormation(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span>{starterCount}/11 starters</span>
        <button type="button" onClick={autoFill}>Auto</button>
        <button type="button" onClick={() => void saveLineup()} disabled={saveTactics.isPending || starterCount < 11}>
          {saveTactics.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {message ? <p className="club-lineup-message">{message}</p> : null}
      {saveTactics.error ? <Banner text={saveTactics.error.message} tone="error" /> : null}

      <div className="club-lineup-grid">
        <div className="club-lineup-pitch">
          {slots.map((slot) => {
            const card = lineup[slot.slotId] ? cardsById.get(Number(lineup[slot.slotId])) : null;
            return (
              <button
                key={slot.slotId}
                type="button"
                className="club-lineup-slot"
                data-active={selectedSlotId === slot.slotId}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onClick={() => setSelectedSlotId(slot.slotId)}
              >
                <span>{slot.label}</span>
                <strong>{card?.name ?? 'Empty'}</strong>
              </button>
            );
          })}
        </div>

        <div className="club-player-select">
          <div className="club-player-select__head">
            <span>Choose for</span>
            <strong>{selectedSlot.label}</strong>
          </div>
          <div className="club-player-list">
            {availableCards.map(({ card, score, fit }) => (
              <button
                key={card.userPlayerId}
                type="button"
                className="club-player-row"
                data-used={usedIds.has(card.userPlayerId)}
                onClick={() => assignPlayer(card.userPlayerId)}
              >
                <span>{card.name}</span>
                <small>{card.positions?.[0]?.position ?? 'ANY'}</small>
                <strong>{Math.round(score * fit)}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="club-mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function roleToPosition(role: string) {
  if (role === 'CB') return 'CB';
  if (role === 'CM') return 'CM';
  if (role === 'ST') return 'ST';
  return role;
}

function playerOverall(card: UserPlayerCard) {
  const stats = card.totalStats ?? {};
  const values = [
    Number(stats.pace ?? 0),
    Number(stats.shooting ?? 0),
    Number(stats.passing ?? 0),
    Number(stats.dribbling ?? 0),
    Number(stats.defensiveAwareness ?? 0),
    Number(stats.gkReflex ?? 0),
  ].filter((value) => Number.isFinite(value) && value > 0);

  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50;
}

function positionFit(card: UserPlayerCard, role: string) {
  const target = roleToPosition(role);
  const positions = card.positions ?? [];
  const direct = positions.find((item) => item.position === target);
  if (direct) return Math.max(0.55, Number(direct.effect ?? 1));
  const broadMatch = positions.some((item) => {
    if (target === 'CB') return item.position?.includes('CB');
    if (target === 'CM') return item.position?.includes('CM') || item.position?.includes('DM');
    if (target === 'ST') return item.position?.includes('ST') || item.position?.includes('CF');
    return item.position?.includes(target);
  });
  return broadMatch ? 0.88 : 0.62;
}

function IconShell({ children }: { children: ReactNode }) {
  return (
    <svg className="club-svg-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (
    <IconShell>
      <path d="M7 3v3M17 3v3M4.5 9h15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 5.5h14v14H5z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 13h2M14 13h2M8 17h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconShell>
  );
}

function ShopIcon() {
  return (
    <IconShell>
      <path d="M6.5 10.5h11l-1 9h-9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconShell>
  );
}

function FormationIcon() {
  return (
    <IconShell>
      <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <circle cx="12" cy="7" r="1.7" fill="currentColor" />
      <circle cx="8" cy="13" r="1.7" fill="currentColor" />
      <circle cx="16" cy="13" r="1.7" fill="currentColor" />
      <circle cx="12" cy="18" r="1.7" fill="currentColor" />
    </IconShell>
  );
}

function PlayersIcon() {
  return (
    <IconShell>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 19c.7-3.2 2.2-5 4.5-5s3.8 1.8 4.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 11.2a2.5 2.5 0 1 0-.5-4.8M15.5 14.2c2 .5 3.3 2 4 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </IconShell>
  );
}

function SparkIcon() {
  return (
    <IconShell>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" fill="currentColor" />
    </IconShell>
  );
}

function PowerIcon() {
  return (
    <IconShell>
      <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7.3 6.8a7 7 0 1 0 9.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconShell>
  );
}

function CloseIcon() {
  return (
    <IconShell>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </IconShell>
  );
}

function WhistleIcon() {
  return (
    <IconShell>
      <path d="M4.5 14.5h7.2a4 4 0 1 0 0-8H9.2l-4.7 8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13.5 8.5h6M18 6l2 2.5-2 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </IconShell>
  );
}

function VersusIcon() {
  return (
    <IconShell>
      <path d="M5 6l4.2 12M10 6L5.8 18M14 6l5 6-5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </IconShell>
  );
}
