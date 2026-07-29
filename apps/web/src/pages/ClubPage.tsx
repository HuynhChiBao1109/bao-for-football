import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Banner } from '../components/feedback';
import { MatchMode } from '../enums/match';
import {
  getCampaignMatchAccess,
  useCampainMatches,
  useCreateCompainNormal,
} from '../hooks/useAiCampaign';
import { useAuth } from '../hooks/useAuth';
import { usePlayerCards } from '../hooks/usePlayerCards';
import { useSession } from '../hooks/useSession';
import { useDailyLoginStatus } from '../hooks/useDailyLogin';
import { useSaveTactics, useTactics } from '../hooks/useTactics';
import {
  useTrainingRoom,
  useTriggerTrainingEvent,
  type TrainingEventType,
} from '../hooks/useTrainingRoom';
import { useMatchMotion } from '../hooks/useMatchMotion';
import { EPlayerSkill, skillName } from '../enums/skill';
import { queryClient } from '../lib/queryClient';
import { normalizeSnapshot } from '../lib/normalizeMatchSnapshot';
import { DEFAULT_CLUB_IMAGE } from '../lib/referenceImage';
import { ROUTES } from '../routes';
import { GachaPage } from './GachaPage';
import { PlayerDetailPopup } from './PlayerDetailPage';
import { TacticsPopup } from './TacticsPage';
import { DailyLoginPopup } from '../components/daily-login/DailyLoginPopup';
import type {
  CampaignMatch,
  MatchPitchPlayer,
  MatchSnapshot,
  Tactics,
  UserPlayerCard,
} from '../types';
import '../MatchView.css';
import './ClubPage.css';

type ClubModal =
  | 'campaign'
  | 'lineup'
  | 'gacha'
  | 'pvp'
  | 'shop'
  | 'training'
  | 'daily-login'
  | null;

type HubAction = {
  label: string;
  eyebrow: string;
  description: string;
  icon: ReactNode;
  modal: Exclude<ClubModal, null>;
  tone?: 'cyan' | 'gold' | 'red';
};

type LineupSlot = {
  slotId: string;
  role: string;
  label: string;
  x: number;
  y: number;
};
type LineupSlotOverride = Pick<LineupSlot, 'role' | 'x' | 'y'>;
type TrainingPosition = { x: number; y: number };
type TrainingEventKey = TrainingEventType;
type LineupDragState = { playerId: number; fromSlotId: string | null };

const TRAINING_MATCH_EVENT = {
  PASS: 35,
  SHOOT: 36,
  DRIBBLE: 39,
  SKILL_USED: 41,
} as const;

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

function formatDashboardNumber(value?: number | null) {
  return Number(value ?? 0).toLocaleString('vi-VN');
}

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
  '3-5-2': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 28, y: 78 },
    { slotId: 'cb', role: 'CB', label: 'CB', x: 50, y: 80 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 72, y: 78 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 14, y: 56 },
    { slotId: 'lcm', role: 'CM', label: 'CM', x: 34, y: 58 },
    { slotId: 'cm', role: 'CM', label: 'CM', x: 50, y: 53 },
    { slotId: 'rcm', role: 'CM', label: 'CM', x: 66, y: 58 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 86, y: 56 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 42, y: 24 },
    { slotId: 'st2', role: 'ST', label: 'ST', x: 58, y: 24 },
  ],
  '3-4-3': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 28, y: 78 },
    { slotId: 'cb', role: 'CB', label: 'CB', x: 50, y: 80 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 72, y: 78 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 17, y: 56 },
    { slotId: 'lcm', role: 'CM', label: 'CM', x: 40, y: 58 },
    { slotId: 'rcm', role: 'CM', label: 'CM', x: 60, y: 58 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 83, y: 56 },
    { slotId: 'lw', role: 'LW', label: 'LW', x: 20, y: 28 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 22 },
    { slotId: 'rw', role: 'RW', label: 'RW', x: 80, y: 28 },
  ],
  '4-5-1': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 17, y: 76 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 38, y: 78 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 62, y: 78 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 83, y: 76 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 15, y: 48 },
    { slotId: 'lcm', role: 'CM', label: 'CM', x: 33, y: 57 },
    { slotId: 'cm', role: 'CM', label: 'CM', x: 50, y: 53 },
    { slotId: 'rcm', role: 'CM', label: 'CM', x: 67, y: 57 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 85, y: 48 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 23 },
  ],
  '5-4-1': [
    { slotId: 'gk', role: 'GK', label: 'GK', x: 50, y: 92 },
    { slotId: 'lb', role: 'LB', label: 'LB', x: 10, y: 69 },
    { slotId: 'lcb', role: 'CB', label: 'CB', x: 30, y: 79 },
    { slotId: 'cb', role: 'CB', label: 'CB', x: 50, y: 81 },
    { slotId: 'rcb', role: 'CB', label: 'CB', x: 70, y: 79 },
    { slotId: 'rb', role: 'RB', label: 'RB', x: 90, y: 69 },
    { slotId: 'lm', role: 'LM', label: 'LM', x: 17, y: 50 },
    { slotId: 'lcm', role: 'CM', label: 'CM', x: 40, y: 57 },
    { slotId: 'rcm', role: 'CM', label: 'CM', x: 60, y: 57 },
    { slotId: 'rm', role: 'RM', label: 'RM', x: 83, y: 50 },
    { slotId: 'st', role: 'ST', label: 'ST', x: 50, y: 22 },
  ],
};

const LINEUP_POSITION_OPTIONS = [
  'LB',
  'CB',
  'RB',
  'CDM',
  'CM',
  'AM',
  'LM',
  'RM',
  'LW',
  'RW',
  'SS',
  'ST',
] as const;

export function ClubPage() {
  const { data: sessionData, isLoading } = useSession();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeModal, setActiveModal] = useState<ClubModal>(null);

  const team = sessionData?.team ?? null;
  const userName = sessionData?.user?.userName || 'Player';
  const dailyLogin = useDailyLoginStatus(Boolean(team));
  const dailyLoginAutoOpened = useRef(false);

  useEffect(() => {
    dailyLoginAutoOpened.current = false;
  }, [sessionData?.user?.id]);

  useEffect(() => {
    const routeState = location.state as { openClubModal?: ClubModal } | null;
    if (routeState?.openClubModal !== 'campaign') return;

    setActiveModal('campaign');
    navigate(ROUTES.club, { replace: true, state: null });
  }, [location.state, navigate]);

  useEffect(() => {
    if (!team || !dailyLogin.data?.canClaim || dailyLoginAutoOpened.current) return;
    dailyLoginAutoOpened.current = true;
    setActiveModal((current) => current ?? 'daily-login');
  }, [dailyLogin.data?.canClaim, team]);

  function handleLogout() {
    setSession(null);
    queryClient.clear();
    navigate(ROUTES.login, { replace: true });
  }

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

  const hubActions: HubAction[] = [
    {
      label: 'Điểm danh',
      eyebrow: '7 Day Streak',
      description: dailyLogin.data?.canClaim ? 'Quà hôm nay đã sẵn sàng.' : 'Xem tiến độ đăng nhập.',
      icon: <GiftIcon />,
      modal: 'daily-login',
      tone: 'gold',
    },
    {
      label: 'Đội hình',
      eyebrow: 'Squad XI',
      description: 'Danh sách cầu thủ hiện tại và đội hình ra sân.',
      icon: <FormationIcon />,
      modal: 'lineup',
      tone: 'red',
    },
    {
      label: 'Campaign',
      eyebrow: 'Red Route',
      description: 'Vào chuỗi trận AI của học viện RedLock.',
      icon: <WhistleIcon />,
      modal: 'campaign',
      tone: 'red',
    },
    {
      label: 'PvP',
      eyebrow: 'Arena',
      description: 'Đang cập nhật.',
      icon: <VersusIcon />,
      modal: 'pvp',
      tone: 'cyan',
    },
    {
      label: 'Shop',
      eyebrow: 'Locker',
      description: 'Đang cập nhật.',
      icon: <ShopIcon />,
      modal: 'shop',
      tone: 'gold',
    },
    {
      label: 'Gacha',
      eyebrow: 'Scout',
      description: 'Roll 1 cầu thủ từ banner hiện tại.',
      icon: <SparkIcon />,
      modal: 'gacha',
      tone: 'gold',
    },
  ];
  const clubAvatar = team.imgUrl || DEFAULT_CLUB_IMAGE;
  const rankText = `#${formatDashboardNumber(team.rankPoint)}`;
  const budgetText = formatDashboardNumber(team.budget);

  return (
    <section className="club-dashboard">
      <div className="club-dashboard__field" aria-hidden="true" />
      <div className="club-dashboard__player" aria-hidden="true" />
      <div className="club-dashboard__scan" aria-hidden="true" />

      <header className="club-dashboard__top club-dashboard__top--status">
        <button
          type="button"
          className="club-profile-card"
          onClick={() => navigate(ROUTES.players)}
          aria-label="Mở danh sách cầu thủ"
          title="Players"
        >
          <img
            className="club-profile-card__avatar"
            src={clubAvatar}
            alt={`${userName} avatar`}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = DEFAULT_CLUB_IMAGE;
            }}
          />
          <span className="club-profile-card__text">
            <small>Player</small>
            <strong>{userName}</strong>
          </span>
        </button>

        <div className="club-top-stats" aria-label="Thông tin câu lạc bộ">
          <div className="club-top-stat">
            <span>Ranking</span>
            <strong>{rankText}</strong>
          </div>
          <div className="club-top-stat">
            <span>CLB</span>
            <strong>{team.teamName}</strong>
          </div>
          <div className="club-top-stat" data-tone="gold">
            <span>Money</span>
            <strong>{budgetText}</strong>
          </div>
        </div>

        <button
          type="button"
          className="club-icon-button club-icon-button--small club-dashboard__logout"
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
        <small>RedLock Stadium Protocol</small>
      </div>

      <nav className="club-dashboard__hub" aria-label="Main actions">
        {hubActions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            className="club-hub-card"
            data-tone={action.tone ?? 'cyan'}
            style={{ animationDelay: `${index * 70}ms` }}
            onClick={() => setActiveModal(action.modal)}
            aria-label={action.label}
            title={action.label}
          >
            <span className="club-hub-card__icon">{action.icon}</span>
            <span className="club-hub-card__content">
              <small>{action.eyebrow}</small>
              <strong>{action.label}</strong>
              <span>{action.description}</span>
            </span>
          </button>
        ))}
      </nav>

      {activeModal ? (
        <ClubModalShell
          title={getClubModalTitle(activeModal)}
          tone={getClubModalTone(activeModal)}
          onClose={() => setActiveModal(null)}
        >
          {activeModal === 'campaign' ? (
            <CampaignPopup teamId={Number(team.id)} />
          ) : activeModal === 'daily-login' ? (
            <DailyLoginPopup
              status={dailyLogin.data}
              isLoading={dailyLogin.isLoading}
              error={dailyLogin.error}
            />
          ) : activeModal === 'lineup' ? (
            <LineupPopup teamId={`team-${team.id}`} />
          ) : activeModal === 'gacha' ? (
            <div className="club-popup club-popup--gacha">
              <GachaPage />
            </div>
          ) : activeModal === 'pvp' ? (
            <ComingSoonPopup feature="PvP" />
          ) : activeModal === 'shop' ? (
            <ComingSoonPopup feature="Shop" />
          ) : (
            <TrainingPopup />
          )}
        </ClubModalShell>
      ) : null}
    </section>
  );
}

function getClubModalTitle(modal: Exclude<ClubModal, null>) {
  if (modal === 'daily-login') return 'Điểm danh 7 ngày';
  if (modal === 'campaign') return 'Campaign';
  if (modal === 'lineup') return 'Đội hình';
  if (modal === 'gacha') return 'Gacha';
  if (modal === 'pvp') return 'PvP';
  if (modal === 'training') return 'Training Room';
  return 'Shop';
}

function getClubModalTone(modal: Exclude<ClubModal, null>) {
  if (modal === 'daily-login') return 'gold';
  if (modal === 'campaign' || modal === 'lineup') return 'red';
  if (modal === 'gacha' || modal === 'shop') return 'gold';
  return 'cyan';
}

function ClubModalShell({
  title,
  tone,
  onClose,
  children,
}: {
  title: string;
  tone: 'cyan' | 'gold' | 'red';
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="club-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="club-modal__backdrop" onClick={onClose} aria-label="Close" />
      <section className="club-modal__panel" data-tone={tone}>
        <header className="club-modal__head">
          <div>
            <span>
              {tone === 'gold'
                ? 'Scout protocol'
                : tone === 'red'
                  ? 'RedLock protocol'
                  : 'Arena status'}
            </span>
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

function ComingSoonPopup({ feature }: { feature: 'PvP' | 'Shop' }) {
  return (
    <div className="club-popup club-popup--soon">
      <div className="club-soon-panel">
        <span>{feature}</span>
        <strong>Đang cập nhật</strong>
      </div>
    </div>
  );
}

function CampaignPopup({ teamId }: { teamId: number }) {
  const { data: matches = [], isLoading, isFetching, error, refetch } = useCampainMatches(teamId);
  const createCampaign = useCreateCompainNormal();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [initAttempted, setInitAttempted] = useState(false);
  const [selectedCampaignMatchId, setSelectedCampaignMatchId] = useState<string>('');

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
  const campaignLevel = useMemo(
    () =>
      matches.reduce(
        (max, item) => Math.max(max, Number(item.campainLevel ?? item.campain?.level ?? 1)),
        1,
      ),
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
              campaignLevel={campaignLevel}
              onStart={async () => {
                setSelectedCampaignMatchId(String(match.id));
              }}
            />
          ))}
        </div>
      )}
      {selectedCampaignMatchId ? (
        <TacticsPopup
          campaignMatchId={selectedCampaignMatchId}
          onClose={() => setSelectedCampaignMatchId('')}
        />
      ) : null}
    </div>
  );
}

function CampaignPopupCard({
  match,
  campaignLevel,
  isStarting,
  onStart,
}: {
  match: CampaignMatch;
  campaignLevel: number;
  isStarting?: boolean;
  onStart: () => Promise<void>;
}) {
  const clubName = match.competitor?.name || `BOT #${String(match.competitorId ?? '-')}`;
  const level = Number(match.level ?? 0);
  const { isCleared, isLocked, mustRetry } = getCampaignMatchAccess(match, campaignLevel);

  return (
    <article className="club-campaign-card" data-locked={isLocked} data-cleared={isCleared}>
      <span>
        Match {level} / {isCleared ? 'Cleared' : isLocked ? 'Locked' : mustRetry ? 'Retry' : 'Open'}
      </span>
      <strong>{clubName}</strong>
      <p>{Number(match.matchReward ?? 0).toLocaleString()} reward</p>
      <button
        type="button"
        disabled={isStarting || isLocked || isCleared}
        title={isLocked ? `Win match ${level - 1} to unlock` : undefined}
        onClick={() => void onStart()}
      >
        {isCleared
          ? 'Completed'
          : isLocked
            ? 'Locked'
            : isStarting
              ? 'Starting...'
              : mustRetry
                ? 'Retry Match'
                : 'Start Match'}
      </button>
    </article>
  );
}

function LineupPopup({ teamId }: { teamId: string }) {
  const { data: loaded } = useTactics(teamId);
  const { data: cards = [] } = usePlayerCards();
  const saveTactics = useSaveTactics();
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [formation, setFormation] = useState('4-3-3');
  const [lineup, setLineup] = useState<Record<string, number | null>>({});
  const [slotOverrides, setSlotOverrides] = useState<Record<string, LineupSlotOverride>>({});
  const [selectedSlotId, setSelectedSlotId] = useState('gk');
  const [message, setMessage] = useState('');
  const [detailPlayerId, setDetailPlayerId] = useState<number | null>(null);
  const [dragState, setDragState] = useState<LineupDragState | null>(null);
  const [movingSlotId, setMovingSlotId] = useState<string | null>(null);
  const formationSlots = FORMATION_SLOTS[formation] ?? FORMATION_SLOTS['4-3-3'];
  const slots = useMemo(
    () =>
      formationSlots.map((slot) => {
        const override = slotOverrides[slot.slotId];
        return override
          ? { ...slot, ...override, label: override.role }
          : slot;
      }),
    [formationSlots, slotOverrides],
  );

  useEffect(() => {
    if (!loaded) return;
    const nextFormation = FORMATION_SLOTS[loaded.formation]
      ? loaded.formation
      : '4-3-3';
    const nextFormationSlots = FORMATION_SLOTS[nextFormation];
    const loadedBySlot = new Map(loaded.lineup?.map((item) => [item.slotId, item]) ?? []);
    const next: Record<string, number | null> = {};
    loaded.lineup?.forEach((item) => {
      next[item.slotId] = Number(item.userPlayerId);
    });
    setFormation(nextFormation);
    setLineup(next);
    setSlotOverrides(
      Object.fromEntries(
        nextFormationSlots.map((slot) => {
          const saved = loadedBySlot.get(slot.slotId);
          const savedRole = String(saved?.position || '').toUpperCase();
          const role =
            slot.slotId === 'gk'
              ? 'GK'
              : LINEUP_POSITION_OPTIONS.includes(
                    savedRole as (typeof LINEUP_POSITION_OPTIONS)[number],
                  )
                ? savedRole
                : slot.role;
          return [
            slot.slotId,
            {
              role,
              x: normalizeLineupCoordinate(saved?.x, slot.x),
              y: normalizeLineupCoordinate(saved?.y, slot.y),
            },
          ];
        }),
      ),
    );
  }, [loaded]);

  useEffect(() => {
    setLineup((prev) => {
      const next: Record<string, number | null> = {};
      formationSlots.forEach((slot) => {
        next[slot.slotId] = prev[slot.slotId] ?? null;
      });
      return next;
    });
    setSelectedSlotId((prev) =>
      formationSlots.some((slot) => slot.slotId === prev) ? prev : formationSlots[0].slotId,
    );
  }, [formationSlots]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.userPlayerId, card])), [cards]);
  useEffect(() => {
    setLineup((prev) => {
      let changed = false;
      const next = { ...prev };
      slots.forEach((slot) => {
        const card = next[slot.slotId] ? cardsById.get(Number(next[slot.slotId])) : null;
        if (card && !canPlaceCardInSlot(card, slot)) {
          next[slot.slotId] = null;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [cardsById, slots]);
  const usedIds = useMemo(
    () => new Set(Object.values(lineup).filter(Boolean) as number[]),
    [lineup],
  );
  const selectedSlot = slots.find((slot) => slot.slotId === selectedSlotId) ?? slots[0];
  const availableCards = useMemo(
    () =>
      cards
        .map((card) => ({
          card,
          score: playerOverall(card),
          fit: positionFit(card, selectedSlot.role),
        }))
        .sort((a, b) => b.fit - a.fit || b.score - a.score),
    [cards, selectedSlot.role],
  );
  const startingLineup = useMemo(
    () =>
      slots.map((slot) => ({
        slot,
        card: lineup[slot.slotId] ? cardsById.get(Number(lineup[slot.slotId])) : null,
      })),
    [cardsById, lineup, slots],
  );
  const starterCount = slots.filter((slot) => lineup[slot.slotId]).length;

  function showLineupMessage(text: string) {
    setMessage(text);
  }

  function changeFormation(nextFormation: string) {
    const nextSlots = FORMATION_SLOTS[nextFormation];
    if (!nextSlots) return;
    setLineup((previous) => {
      const next: Record<string, number | null> = {};
      const preservedIds = new Set<number>();
      nextSlots.forEach((slot) => {
        const playerId = Number(previous[slot.slotId] ?? 0);
        next[slot.slotId] = playerId > 0 ? playerId : null;
        if (playerId > 0) preservedIds.add(playerId);
      });

      const remainingIds = Object.values(previous)
        .map((playerId) => Number(playerId ?? 0))
        .filter((playerId) => playerId > 0 && !preservedIds.has(playerId));
      nextSlots.forEach((slot) => {
        if (next[slot.slotId]) return;
        let bestRemainingIndex = -1;
        let bestFit = Number.NEGATIVE_INFINITY;
        remainingIds.forEach((playerId, index) => {
          const card = cardsById.get(playerId);
          if (!card || !canPlaceCardInSlot(card, slot)) return;
          const fit = positionFit(card, slot.role);
          if (fit > bestFit) {
            bestFit = fit;
            bestRemainingIndex = index;
          }
        });
        if (bestRemainingIndex >= 0) {
          next[slot.slotId] = remainingIds.splice(bestRemainingIndex, 1)[0];
        }
      });
      return next;
    });
    setFormation(nextFormation);
    setSlotOverrides(
      Object.fromEntries(
        nextSlots.map((slot) => [
          slot.slotId,
          { role: slot.role, x: slot.x, y: slot.y },
        ]),
      ),
    );
    setMessage('');
  }

  function updateSlotOverride(slotId: string, update: Partial<LineupSlotOverride>) {
    const current = slots.find((slot) => slot.slotId === slotId);
    if (!current) return;
    setSlotOverrides((previous) => ({
      ...previous,
      [slotId]: {
        role: update.role ?? current.role,
        x: normalizeLineupCoordinate(update.x, current.x),
        y: normalizeLineupCoordinate(update.y, current.y),
      },
    }));
  }

  function resetSlotPlacement(slotId: string) {
    const baseSlot = formationSlots.find((slot) => slot.slotId === slotId);
    if (!baseSlot) return;
    updateSlotOverride(slotId, {
      role: baseSlot.role,
      x: baseSlot.x,
      y: baseSlot.y,
    });
  }

  function moveSlotFromPointer(slotId: string, clientX: number, clientY: number) {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    updateSlotOverride(slotId, {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    });
  }

  function handleMovePointerDown(slotId: string, event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedSlotId(slotId);
    setMovingSlotId(slotId);
    event.currentTarget.setPointerCapture(event.pointerId);
    moveSlotFromPointer(slotId, event.clientX, event.clientY);
  }

  function handleMovePointerMove(slotId: string, event: PointerEvent<HTMLButtonElement>) {
    if (movingSlotId !== slotId) return;
    event.preventDefault();
    moveSlotFromPointer(slotId, event.clientX, event.clientY);
  }

  function finishMovingSlot(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setMovingSlotId(null);
  }

  function assignPlayer(playerId: number, targetSlotId = selectedSlotId, fromSlotId?: string | null) {
    const targetSlot = slots.find((slot) => slot.slotId === targetSlotId);
    const card = cardsById.get(playerId);
    if (!targetSlot || !card) return;

    if (!canPlaceCardInSlot(card, targetSlot)) {
      showLineupMessage(getSlotRejectMessage(card, targetSlot));
      return;
    }

    const targetPlayerId = lineup[targetSlotId] ?? null;
    const sourceSlotId =
      fromSlotId ??
      Object.keys(lineup).find((slotId) => lineup[slotId] === playerId) ??
      null;
    const sourceSlot = sourceSlotId ? slots.find((slot) => slot.slotId === sourceSlotId) : null;
    const targetCard = targetPlayerId ? cardsById.get(Number(targetPlayerId)) : null;
    if (sourceSlot && targetCard && !canPlaceCardInSlot(targetCard, sourceSlot)) {
      showLineupMessage(getSlotRejectMessage(targetCard, sourceSlot));
      return;
    }

    setLineup((prev) => {
      const next = { ...prev };

      Object.keys(next).forEach((slotId) => {
        if (next[slotId] === playerId) next[slotId] = null;
      });
      if (sourceSlotId && targetPlayerId && targetPlayerId !== playerId) {
        next[sourceSlotId] = Number(targetPlayerId);
      }
      next[targetSlotId] = playerId;
      return next;
    });
    setSelectedSlotId(targetSlotId);
    showLineupMessage('');
  }

  function startDrag(playerId: number, fromSlotId: string | null, event: DragEvent<HTMLElement>) {
    setDragState({ playerId, fromSlotId });
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-lineup-player', String(playerId));
    if (fromSlotId) {
      event.dataTransfer.setData('application/x-lineup-slot', fromSlotId);
    }
  }

  function getDraggedPlayer(event: DragEvent<HTMLElement>) {
    const playerId = Number(
      event.dataTransfer.getData('application/x-lineup-player') || dragState?.playerId || 0,
    );
    const fromSlotId =
      event.dataTransfer.getData('application/x-lineup-slot') || dragState?.fromSlotId || null;
    return Number.isFinite(playerId) && playerId > 0 ? { playerId, fromSlotId } : null;
  }

  function handleSlotDragOver(slot: LineupSlot, event: DragEvent<HTMLElement>) {
    const playerId = dragState?.playerId;
    const card = playerId ? cardsById.get(playerId) : null;
    if (!card || canPlaceCardInSlot(card, slot)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    } else {
      event.dataTransfer.dropEffect = 'none';
    }
  }

  function handleSlotDrop(slot: LineupSlot, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const dragged = getDraggedPlayer(event);
    setDragState(null);
    if (!dragged) return;
    assignPlayer(dragged.playerId, slot.slotId, dragged.fromSlotId);
  }

  function autoFill() {
    const pool = [...cards];
    const next: Record<string, number | null> = {};
    slots.forEach((slot) => {
      let bestIndex = 0;
      let bestScore = -1;
      pool.forEach((card, index) => {
        if (!canPlaceCardInSlot(card, slot)) return;
        const score = playerOverall(card) * positionFit(card, slot.role);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      const picked = bestScore >= 0 ? pool.splice(bestIndex, 1)[0] : null;
      next[slot.slotId] = picked?.userPlayerId ?? null;
    });
    setLineup(next);
    setMessage('');
  }

  async function saveLineup() {
    const invalidSlot = slots.find((slot) => {
      const card = lineup[slot.slotId] ? cardsById.get(Number(lineup[slot.slotId])) : null;
      return card && !canPlaceCardInSlot(card, slot);
    });
    if (invalidSlot) {
      setMessage(`Slot ${invalidSlot.label} has an invalid player.`);
      return;
    }

    const payload = slots
      .map((slot) => ({
        slotId: slot.slotId,
        position: roleToPosition(slot.role),
        userPlayerId: Number(lineup[slot.slotId] ?? 0),
        x: slot.x,
        y: slot.y,
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
              onClick={() => changeFormation(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <span>{starterCount}/11 starters</span>
        <button type="button" onClick={autoFill}>
          Auto
        </button>
        <button
          type="button"
          onClick={() => void saveLineup()}
          disabled={saveTactics.isPending || starterCount < 11}
        >
          {saveTactics.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>

      {message ? <p className="club-lineup-message">{message}</p> : null}
      {saveTactics.error ? <Banner text={saveTactics.error.message} tone="error" /> : null}

      <section className="club-lineup-inspector" aria-label="Selected lineup position">
        <div className="club-lineup-inspector__identity">
          <span>Selected slot</span>
          <strong>
            {lineup[selectedSlot.slotId]
              ? cardsById.get(Number(lineup[selectedSlot.slotId]))?.name ?? 'Starter'
              : 'Empty slot'}
          </strong>
          <small>{selectedSlot.slotId.toUpperCase()}</small>
        </div>
        <label>
          <span>Position</span>
          <select
            value={selectedSlot.role}
            disabled={selectedSlot.slotId === 'gk'}
            onChange={(event) =>
              updateSlotOverride(selectedSlot.slotId, { role: event.target.value })
            }
          >
            {selectedSlot.slotId === 'gk' ? <option value="GK">GK</option> : null}
            {selectedSlot.slotId !== 'gk'
              ? LINEUP_POSITION_OPTIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))
              : null}
          </select>
        </label>
        <label>
          <span>X</span>
          <input
            type="number"
            min="5"
            max="95"
            step="0.5"
            value={selectedSlot.x}
            onChange={(event) =>
              updateSlotOverride(selectedSlot.slotId, { x: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <span>Y</span>
          <input
            type="number"
            min="5"
            max="95"
            step="0.5"
            value={selectedSlot.y}
            onChange={(event) =>
              updateSlotOverride(selectedSlot.slotId, { y: Number(event.target.value) })
            }
          />
        </label>
        <button
          type="button"
          className="club-lineup-inspector__reset"
          title="Reset selected position"
          onClick={() => resetSlotPlacement(selectedSlot.slotId)}
        >
          Reset
        </button>
      </section>

      <div className="club-lineup-grid">
        <div className="club-lineup-board">
          <div ref={pitchRef} className="club-lineup-pitch">
            {startingLineup.map(({ slot, card }) => (
              <div
                key={slot.slotId}
                className="club-lineup-slot"
                data-active={selectedSlotId === slot.slotId}
                data-moving={movingSlotId === slot.slotId}
                data-drop-valid={
                  dragState
                    ? Boolean(
                        cardsById.get(dragState.playerId) &&
                          canPlaceCardInSlot(cardsById.get(dragState.playerId)!, slot),
                      )
                    : undefined
                }
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onClick={() => setSelectedSlotId(slot.slotId)}
                onDragOver={(event) => handleSlotDragOver(slot, event)}
                onDrop={(event) => handleSlotDrop(slot, event)}
              >
                <button
                  type="button"
                  className="club-lineup-slot__move"
                  title={`Move ${slot.label} position`}
                  aria-label={`Move ${slot.label} position`}
                  onPointerDown={(event) => handleMovePointerDown(slot.slotId, event)}
                  onPointerMove={(event) => handleMovePointerMove(slot.slotId, event)}
                  onPointerUp={finishMovingSlot}
                  onPointerCancel={finishMovingSlot}
                >
                  <MoveIcon />
                </button>
                <span>{slot.label}</span>
                <strong>{card?.name ?? 'Empty'}</strong>
                {card ? (
                  <button
                    type="button"
                    className="club-lineup-slot__detail"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDetailPlayerId(card.userPlayerId);
                    }}
                  >
                    Detail
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="club-starter-strip">
            {startingLineup.map(({ slot, card }) => (
              <button
                key={`strip-${slot.slotId}`}
                type="button"
                data-active={selectedSlotId === slot.slotId}
                onClick={() => setSelectedSlotId(slot.slotId)}
              >
                <span>{slot.label}</span>
                <strong>{card?.name ?? 'Trống'}</strong>
              </button>
            ))}
          </div>
        </div>

        <div className="club-player-select">
          <div className="club-player-select__head">
            <span>Cầu thủ hiện tại</span>
            <strong>{cards.length} players</strong>
            <small>Đang chọn {selectedSlot.label}</small>
          </div>
          <div className="club-roster-list game-scroll">
            {availableCards.length === 0 ? (
              <p className="club-roster-empty">Chưa có cầu thủ.</p>
            ) : null}
            {availableCards.map(({ card, score, fit }) => (
              <button
                key={card.userPlayerId}
                type="button"
                className="club-roster-row"
                data-used={usedIds.has(card.userPlayerId)}
                data-invalid={!canPlaceCardInSlot(card, selectedSlot)}
                draggable
                aria-disabled={!canPlaceCardInSlot(card, selectedSlot)}
                onDragStart={(event) => startDrag(card.userPlayerId, null, event)}
                onDragEnd={() => setDragState(null)}
                onClick={() => assignPlayer(card.userPlayerId)}
              >
                <span>{card.positions?.[0]?.position ?? 'ANY'}</span>
                <strong>{card.name}</strong>
                <small>
                  OVR {Math.round(score)} / FIT {Math.round(fit * 100)}
                </small>
              </button>
            ))}
          </div>
        </div>
      </div>
      {detailPlayerId ? (
        <PlayerDetailPopup userPlayerId={detailPlayerId} onClose={() => setDetailPlayerId(null)} />
      ) : null}
    </div>
  );
}

const TRAINING_EVENTS: Array<{
  key: TrainingEventKey;
  label: string;
  description: string;
  tone: 'cyan' | 'gold' | 'red';
}> = [
  { key: 'warmup', label: 'Warm Up', description: 'Tang do san sang', tone: 'cyan' },
  { key: 'sprint', label: 'Sprint', description: 'Chay toc do cao', tone: 'red' },
  { key: 'pass_normal', label: 'Pass', description: 'Chuyen thuong', tone: 'cyan' },
  { key: 'pass_through', label: 'Through', description: 'Chot khe vao khoang trong', tone: 'red' },
  { key: 'pass_lob', label: 'Lob', description: 'Chuyen bong qua tuyen', tone: 'gold' },
  { key: 'shooting', label: 'Shoot Drill', description: 'Dut diem lien tuc', tone: 'gold' },
  { key: 'skill', label: 'Skill Burst', description: 'Kich hoat skill', tone: 'red' },
  { key: 'dribble_magic', label: 'Magic 1v1', description: 'Re bong qua nguoi', tone: 'red' },
  { key: 'dribble_lightning', label: 'Lightning 1vN', description: 'Re bong sam set', tone: 'red' },
  { key: 'tank_tackle', label: 'Tank Tackle', description: 'Huc va cuop bong', tone: 'gold' },
  { key: 'free_kick_pass', label: 'FK Pass', description: 'Da phat chuyen ngan', tone: 'cyan' },
  { key: 'free_kick_through', label: 'FK Through', description: 'Da phat chot khe', tone: 'red' },
  { key: 'free_kick_lob', label: 'FK Lob', description: 'Da phat treo bong', tone: 'gold' },
  { key: 'free_kick_shoot', label: 'FK Shoot', description: 'Da phat sut thang', tone: 'red' },
];

function skillCode(skill: number) {
  if (skill === EPlayerSkill.SHOOT_THUNDER) return 'TS';
  if (skill === EPlayerSkill.DRIBBLE_MAGIC) return 'MD';
  if (skill === EPlayerSkill.TANK_TACKLE) return 'TT';
  if (skill === EPlayerSkill.LIGHTNING_DRIBBLE) return 'LD';
  if (skill === EPlayerSkill.KAISER_SHOT) return 'KS';
  if (skill === EPlayerSkill.EAGLE_EYE) return 'EE';
  return 'SK';
}

function TrainingPopup() {
  const { data: trainingRoom, isLoading, error } = useTrainingRoom();
  const triggerTrainingEvent = useTriggerTrainingEvent();
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<Record<number, TrainingPosition>>({});
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<number | null>(null);
  const [activeEvent, setActiveEvent] = useState<TrainingEventKey>('warmup');
  const [playerCount, setPlayerCount] = useState(11);
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>([]);
  const [eventLog, setEventLog] = useState<
    Array<{ id: number; tick: number; event: string; player: string }>
  >([]);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [metrics, setMetrics] = useState({
    event: 'idle',
    playerSpeed: 0,
    ballSpeed: 0,
    distance: 0,
    durationSeconds: 0,
  });
  const cards = trainingRoom?.players ?? [];
  const goalkeeper = useMemo(() => cards.find(isGoalkeeperCard) ?? cards[0] ?? null, [cards]);
  const activeCards = useMemo(() => {
    const activeSet = new Set(activePlayerIds);
    const picked = cards.filter((card) => activeSet.has(card.userPlayerId));
    if (!goalkeeper) return picked;
    if (picked.some((card) => card.userPlayerId === goalkeeper.userPlayerId)) return picked;
    return [goalkeeper, ...picked].slice(0, playerCount);
  }, [activePlayerIds, cards, goalkeeper, playerCount]);
  const renderedSnapshot = useMatchMotion(snapshot);

  useEffect(() => {
    if (!trainingRoom) return;
    setSnapshot(normalizeSnapshot(trainingRoom.snapshot));
    setPositions(
      Object.fromEntries(
        trainingRoom.playerStates.map((player) => [
          player.userPlayerId,
          {
            x: player.x,
            y: player.y,
          },
        ]),
      ),
    );
    setMetrics(trainingRoom.metrics);
    setSelectedPlayerId((current) => current ?? trainingRoom.playerStates[0]?.userPlayerId ?? null);
  }, [trainingRoom]);

  useEffect(() => {
    if (trainingRoom) return;
    setPositions((current) => {
      const next = { ...current };
      cards.forEach((card, index) => {
        if (next[card.userPlayerId]) return;
        const column = index % 6;
        const row = Math.floor(index / 6);
        next[card.userPlayerId] = {
          x: 12 + column * 15,
          y: 18 + (row % 5) * 16,
        };
      });
      return next;
    });
  }, [cards, trainingRoom]);

  useEffect(() => {
    if (!cards.length || activePlayerIds.length > 0) return;
    setActivePlayerIds(pickTrainingPlayerIds(cards, playerCount));
  }, [activePlayerIds.length, cards, playerCount]);

  useEffect(() => {
    if (!cards.length) return;
    setActivePlayerIds((current) => normalizeTrainingPlayerIds(cards, current, playerCount));
  }, [cards, playerCount]);

  useEffect(() => {
    if (!activeCards.length) return;
    setSelectedPlayerId((current) =>
      activeCards.some((card) => card.userPlayerId === current)
        ? current
        : activeCards[0].userPlayerId,
    );
  }, [activeCards]);

  const selectedPlayer = useMemo(
    () =>
      activeCards.find((card) => card.userPlayerId === selectedPlayerId) ?? activeCards[0] ?? null,
    [activeCards, selectedPlayerId],
  );

  function pointFromEvent(event: { clientX: number; clientY: number }): TrainingPosition | null {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampNumber(((event.clientY - rect.top) / rect.height) * 100, 5, 95),
      y: clampNumber(((event.clientX - rect.left) / rect.width) * 100, 7, 93),
    };
  }

  function movePlayer(playerId: number, point: TrainingPosition | null) {
    if (!point) return;
    setPositions((current) => ({
      ...current,
      [playerId]: point,
    }));
  }

  function handlePitchPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingPlayerId) return;
    movePlayer(draggingPlayerId, pointFromEvent(event));
  }

  function handlePitchPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (draggingPlayerId) {
      movePlayer(draggingPlayerId, pointFromEvent(event));
      setDraggingPlayerId(null);
    }
  }

  function handlePitchClick(event: MouseEvent<HTMLDivElement>) {
    if (!selectedPlayerId || draggingPlayerId) return;
    movePlayer(selectedPlayerId, pointFromEvent(event));
  }

  async function triggerEvent(eventKey: TrainingEventKey) {
    setActiveEvent(eventKey);
    const response = await triggerTrainingEvent.mutateAsync({
      event: eventKey,
      selectedPlayerId: selectedPlayer?.userPlayerId ?? null,
      activePlayerIds: activeCards.map((card) => card.userPlayerId),
      positions: Object.fromEntries(
        Object.entries(positions).map(([playerId, point]) => [playerId, point]),
      ),
      tick: metrics.event === 'idle' ? 0 : (eventLog[0]?.tick ?? trainingRoom?.tick ?? 0),
    });
    setSnapshot(normalizeSnapshot(response.snapshot));
    setPositions(
      Object.fromEntries(
        response.playerStates.map((player) => [
          player.userPlayerId,
          {
            x: player.x,
            y: player.y,
          },
        ]),
      ),
    );
    setMetrics(response.metrics);
    setEventLog((current) =>
      [
        ...response.eventLog.map((item) => ({
          id: Date.now() + item.tick,
          tick: item.tick,
          event: item.label,
          player: item.playerName,
        })),
        ...current,
      ].slice(0, 8),
    );
  }

  function autoSpread() {
    setPositions(
      Object.fromEntries(
        activeCards.map((card, index) => {
          const column = index % 6;
          const row = Math.floor(index / 6);
          return [
            card.userPlayerId,
            {
              x: 10 + column * 16,
              y: 16 + (row % 5) * 17,
            },
          ];
        }),
      ),
    );
  }

  function toggleActivePlayer(playerId: number) {
    const card = cards.find((item) => item.userPlayerId === playerId);
    if (!card || isGoalkeeperCard(card)) return;
    setActivePlayerIds((current) => {
      const hasPlayer = current.includes(playerId);
      const withoutPlayer = current.filter((id) => id !== playerId);
      if (hasPlayer) {
        return normalizeTrainingPlayerIds(cards, withoutPlayer, playerCount);
      }
      return normalizeTrainingPlayerIds(cards, [...current, playerId], playerCount);
    });
  }

  return (
    <div className="club-popup club-popup--training">
      {error ? <Banner text={(error as Error).message} tone="error" /> : null}
      {triggerTrainingEvent.error ? (
        <Banner text={triggerTrainingEvent.error.message} tone="error" />
      ) : null}
      <div className="club-training">
        <TrainingMatchStage
          snapshot={renderedSnapshot}
          selectedPlayerId={selectedPlayerId}
          isLoading={isLoading}
          hasPlayers={activeCards.length > 0}
          activePlayerIds={activeCards.map((card) => card.userPlayerId)}
          positions={positions}
          pitchRef={pitchRef}
          activeEvent={activeEvent}
          draggingPlayerId={draggingPlayerId}
          onSelectPlayer={setSelectedPlayerId}
          onDragStart={setDraggingPlayerId}
          onDragEnd={setDraggingPlayerId}
          onPointerMove={handlePitchPointerMove}
          onPointerUp={handlePitchPointerUp}
          onPitchClick={handlePitchClick}
        />

        <aside className="club-training-panel">
          <div className="club-training-panel__head">
            <span>Selected</span>
            <strong>{selectedPlayer?.name ?? 'None'}</strong>
            <small>
              {selectedPlayer?.positions?.[0]?.position ?? 'ANY'} / OVR{' '}
              {Math.round(selectedPlayer ? playerOverall(selectedPlayer) : 0)}
            </small>
          </div>

          <div className="club-training-roster">
            <div className="club-training-roster__head">
              <span>Players on pitch</span>
              <strong>
                {activeCards.length}/{Math.min(11, cards.length || 11)}
              </strong>
            </div>
            <input
              type="range"
              min={goalkeeper ? 1 : 0}
              max={Math.min(11, cards.length || 11)}
              value={Math.min(playerCount, Math.min(11, cards.length || 11))}
              onChange={(event) => setPlayerCount(Number(event.target.value))}
            />
            <div className="club-training-roster__list">
              {cards.slice(0, 18).map((card) => {
                const isGk = isGoalkeeperCard(card);
                const isActive = activeCards.some(
                  (item) => item.userPlayerId === card.userPlayerId,
                );
                return (
                  <button
                    key={card.userPlayerId}
                    type="button"
                    data-active={isActive}
                    data-gk={isGk}
                    disabled={isGk}
                    onClick={() => toggleActivePlayer(card.userPlayerId)}
                  >
                    <span>{card.positions?.[0]?.position ?? 'ANY'}</span>
                    <strong>{card.name}</strong>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="club-training-actions">
            {TRAINING_EVENTS.map((item) => (
              <button
                key={item.key}
                type="button"
                data-tone={item.tone}
                data-active={activeEvent === item.key}
                onClick={() => triggerEvent(item.key)}
                disabled={triggerTrainingEvent.isPending}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </button>
            ))}
          </div>

          <button type="button" className="club-training-panel__auto" onClick={autoSpread}>
            Auto arrange
          </button>

          <div className="club-training-metrics">
            <article>
              <span>Ball speed</span>
              <strong>{Number(metrics.ballSpeed ?? 0).toFixed(1)}</strong>
            </article>
            <article>
              <span>Player speed</span>
              <strong>{Number(metrics.playerSpeed ?? 0).toFixed(1)}</strong>
            </article>
            <article>
              <span>Distance</span>
              <strong>{Number(metrics.distance ?? 0).toFixed(1)}</strong>
            </article>
          </div>

          <div className="club-training-log">
            <span>Event Log</span>
            {eventLog.length === 0 ? (
              <p>Chua co event nao.</p>
            ) : (
              eventLog.map((item) => (
                <article key={item.id}>
                  <strong>T{item.tick}</strong>
                  <span>{item.event}</span>
                  <small>{item.player}</small>
                </article>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function TrainingMatchStage({
  snapshot,
  selectedPlayerId,
  positions,
  activePlayerIds,
  isLoading,
  hasPlayers,
  pitchRef,
  activeEvent,
  draggingPlayerId,
  onSelectPlayer,
  onDragStart,
  onDragEnd,
  onPointerMove,
  onPointerUp,
  onPitchClick,
}: {
  snapshot: MatchSnapshot | null;
  selectedPlayerId: number | null;
  positions: Record<number, TrainingPosition>;
  activePlayerIds: number[];
  isLoading: boolean;
  hasPlayers: boolean;
  pitchRef: RefObject<HTMLDivElement | null>;
  activeEvent: TrainingEventKey;
  draggingPlayerId: number | null;
  onSelectPlayer: (playerId: number) => void;
  onDragStart: (playerId: number) => void;
  onDragEnd: (playerId: number | null) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPitchClick: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  const players = useMemo(
    () =>
      snapshot
        ? [...snapshot.homePlayers, ...snapshot.awayPlayers]
            .filter((player) => activePlayerIds.includes(Number(player.id)))
            .map((player) => {
              const override = positions[Number(player.id)];
              return override ? { ...player, x: override.x, y: override.y } : player;
            })
        : [],
    [activePlayerIds, positions, snapshot],
  );
  const highlightedPlayerId = snapshot?.highlight?.actorPlayerId
    ? Number(snapshot.highlight.actorPlayerId)
    : null;
  const activeSkill = snapshot?.highlight?.skill ?? snapshot?.ball.skillTrajectory ?? undefined;

  return (
    <section className="club-training-stage" aria-label="Training match view">
      <header className="club-training-scorebar">
        <div>
          <span>Training Tick</span>
          <strong>{snapshot?.clockLabel ?? 'TR:00'}</strong>
        </div>
        <div>
          <span>Event</span>
          <strong>{snapshot?.highlight?.label || activeEvent.replaceAll('_', ' ')}</strong>
        </div>
        <div>
          <span>Ball</span>
          <strong>{Number(snapshot?.ball.speed ?? 0).toFixed(1)}</strong>
        </div>
      </header>

      <div
        ref={pitchRef}
        className="match-pitch club-training-match-pitch"
        data-event={activeEvent}
        data-active-skill={activeSkill}
        data-dragging={Boolean(draggingPlayerId)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onPitchClick}
      >
        <TrainingPitchLines />
        {snapshot ? (
          <>
            {players.map((player) => (
              <TrainingPlayerNode
                key={`${player.teamSide}-${player.id}`}
                player={player}
                selected={Number(player.id) === selectedPlayerId}
                activeHighlight={highlightedPlayerId === Number(player.id)}
                onSelectPlayer={onSelectPlayer}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
            <TrainingBall snapshot={snapshot} />
            <TrainingSkillOverlay snapshot={snapshot} />
          </>
        ) : (
          <div className="club-training__empty">
            {isLoading
              ? 'Dang tai phong tap...'
              : hasPlayers
                ? 'Chon cau thu de bat dau.'
                : 'Chua co cau thu.'}
          </div>
        )}
      </div>
    </section>
  );
}

function TrainingPitchLines() {
  return (
    <div className="match-pitch__lines" aria-hidden="true">
      <div className="pitch-line pitch-line--outer" />
      <div className="pitch-line pitch-line--mid" />
      <div className="pitch-circle pitch-circle--center" />
      <div className="pitch-spot pitch-spot--center" />
      <div className="pitch-box pitch-box--penalty pitch-box--home" />
      <div className="pitch-box pitch-box--penalty pitch-box--away" />
      <div className="pitch-box pitch-box--goal pitch-box--home" />
      <div className="pitch-box pitch-box--goal pitch-box--away" />
      <div className="pitch-spot pitch-spot--home" />
      <div className="pitch-spot pitch-spot--away" />
      <div className="pitch-goal pitch-goal--home" />
      <div className="pitch-goal pitch-goal--away" />
    </div>
  );
}

function TrainingPlayerNode({
  player,
  selected,
  activeHighlight,
  onSelectPlayer,
  onDragStart,
  onDragEnd,
}: {
  player: MatchPitchPlayer;
  selected: boolean;
  activeHighlight: boolean;
  onSelectPlayer: (playerId: number) => void;
  onDragStart: (playerId: number) => void;
  onDragEnd: (playerId: number | null) => void;
}) {
  const playerId = Number(player.id);
  const teamClass = player.teamSide === 'away' ? 'player-circle--away' : 'player-circle--home';
  const isGoalkeeper = player.position === 'GK';

  return (
    <button
      type="button"
      className={[
        'player-node',
        'club-training-player-node',
        isGoalkeeper ? 'player-node--goalkeeper' : '',
        player.hasBall ? 'player-node--has-ball' : '',
        activeHighlight ? 'player-node--highlight' : '',
        player.activeSkill === EPlayerSkill.DRIBBLE_MAGIC ? 'player-node--magic-dribble' : '',
        player.activeSkill === EPlayerSkill.LIGHTNING_DRIBBLE
          ? 'player-node--lightning-dribble'
          : '',
        player.activeSkill === EPlayerSkill.TANK_TACKLE ? 'player-node--tank-tackle' : '',
        player.activeSkill === EPlayerSkill.KAISER_SHOT ? 'player-node--kaiser-shot' : '',
        player.activeSkill === EPlayerSkill.EAGLE_EYE ? 'player-node--eagle-eye' : '',
      ].join(' ')}
      data-selected={selected}
      style={toHorizontalPitchPosition(player)}
      title={`${player.name} - ${player.position}`}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onSelectPlayer(playerId);
        onDragStart(playerId);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onDragEnd(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectPlayer(playerId);
      }}
    >
      <span className={`player-circle ${teamClass}`}>
        {player.avatarUrl ? (
          <img src={player.avatarUrl} alt="" className="player-avatar" />
        ) : (
          <span className="player-avatar player-avatar--fallback">
            {getPlayerInitials(player.name)}
          </span>
        )}
        <span className="player-number">{player.jerseyNumber ?? player.id}</span>
      </span>
      {player.activeSkill ? (
        <span className="player-skill-badge" title={skillName(player.activeSkill) ?? 'Skill'}>
          {skillCode(player.activeSkill)}
        </span>
      ) : null}
      <span className="player-name">{player.name}</span>
    </button>
  );
}

function TrainingBall({ snapshot }: { snapshot: MatchSnapshot }) {
  const thunderShot =
    snapshot.ball.skillTrajectory === EPlayerSkill.SHOOT_THUNDER ||
    snapshot.highlight?.skill === EPlayerSkill.SHOOT_THUNDER;
  const magicDribble =
    snapshot.ball.skillTrajectory === EPlayerSkill.DRIBBLE_MAGIC ||
    snapshot.highlight?.skill === EPlayerSkill.DRIBBLE_MAGIC;
  const lightningDribble =
    snapshot.ball.skillTrajectory === EPlayerSkill.LIGHTNING_DRIBBLE ||
    snapshot.highlight?.skill === EPlayerSkill.LIGHTNING_DRIBBLE;
  const tankTackle =
    snapshot.ball.skillTrajectory === EPlayerSkill.TANK_TACKLE ||
    snapshot.highlight?.skill === EPlayerSkill.TANK_TACKLE;
  const kaiserShot =
    snapshot.ball.skillTrajectory === EPlayerSkill.KAISER_SHOT ||
    snapshot.highlight?.skill === EPlayerSkill.KAISER_SHOT;
  const eagleEye =
    snapshot.ball.skillTrajectory === EPlayerSkill.EAGLE_EYE ||
    snapshot.highlight?.skill === EPlayerSkill.EAGLE_EYE;

  return (
    <div
      className={[
        'match-ball',
        snapshot.highlight?.event === TRAINING_MATCH_EVENT.SHOOT ? 'match-ball--shot' : '',
        snapshot.highlight?.event === TRAINING_MATCH_EVENT.PASS ? 'match-ball--pass' : '',
        thunderShot ? 'match-ball--thunder' : '',
        magicDribble ? 'match-ball--magic' : '',
        lightningDribble ? 'match-ball--lightning' : '',
        tankTackle ? 'match-ball--tank' : '',
        kaiserShot ? 'match-ball--kaiser' : '',
        eagleEye ? 'match-ball--eagle' : '',
      ].join(' ')}
      style={toHorizontalPitchPosition(snapshot.ball)}
      aria-label="Ball"
    />
  );
}

function TrainingSkillOverlay({ snapshot }: { snapshot: MatchSnapshot }) {
  const skill = snapshot.highlight?.skill ?? snapshot.ball.skillTrajectory ?? null;

  if (!skill || snapshot.highlight?.event !== TRAINING_MATCH_EVENT.SKILL_USED) {
    return null;
  }

  return (
    <div className="skill-overlay" data-skill={skill} aria-hidden="true">
      <span className="skill-overlay__wash" />
      <span className="skill-overlay__pulse" />
      <div className="skill-overlay__label">
        <span>Skill activated</span>
        <strong>{skillName(skill)}</strong>
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

function normalizeLineupCoordinate(value: unknown, fallback: number) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) return fallback;
  return Math.round(clampNumber(coordinate, 5, 95) * 10) / 10;
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

function isGoalkeeperCard(card: UserPlayerCard) {
  return card.positions?.some((item) => item.position === 'GK') ?? false;
}

function isGoalkeeperSlot(slot: LineupSlot) {
  return roleToPosition(slot.role) === 'GK';
}

function canPlaceCardInSlot(card: UserPlayerCard, slot: LineupSlot) {
  const isCardGoalkeeper = isGoalkeeperCard(card);
  const isSlotGoalkeeper = isGoalkeeperSlot(slot);
  return isSlotGoalkeeper ? isCardGoalkeeper : !isCardGoalkeeper;
}

function getSlotRejectMessage(card: UserPlayerCard, slot: LineupSlot) {
  if (isGoalkeeperSlot(slot)) {
    return `${card.name} is not a GK. GK slot only accepts goalkeepers.`;
  }
  if (isGoalkeeperCard(card)) {
    return `${card.name} is a GK. Goalkeepers can only be placed in GK slot.`;
  }
  return `${card.name} does not fit ${slot.label}.`;
}

function pickTrainingPlayerIds(cards: UserPlayerCard[], count: number) {
  const normalizedCount = clampNumber(Math.round(count), 0, Math.min(11, cards.length));
  const goalkeeper = cards.find(isGoalkeeperCard) ?? cards[0] ?? null;
  const outfield = cards
    .filter((card) => card.userPlayerId !== goalkeeper?.userPlayerId)
    .sort((left, right) => playerOverall(right) - playerOverall(left));
  return [goalkeeper, ...outfield]
    .filter((card): card is UserPlayerCard => Boolean(card))
    .slice(0, normalizedCount)
    .map((card) => card.userPlayerId);
}

function normalizeTrainingPlayerIds(cards: UserPlayerCard[], selectedIds: number[], count: number) {
  const maxCount = Math.min(11, cards.length);
  const normalizedCount = clampNumber(Math.round(count), 0, maxCount);
  const selected = new Set(selectedIds);
  const goalkeeper = cards.find(isGoalkeeperCard) ?? cards[0] ?? null;
  if (goalkeeper) {
    selected.add(goalkeeper.userPlayerId);
  }

  const ordered = cards
    .filter((card) => selected.has(card.userPlayerId))
    .sort((left, right) => Number(isGoalkeeperCard(right)) - Number(isGoalkeeperCard(left)));
  const picked = ordered.slice(0, normalizedCount);

  if (picked.length < normalizedCount) {
    const pickedSet = new Set(picked.map((card) => card.userPlayerId));
    cards
      .filter((card) => !pickedSet.has(card.userPlayerId))
      .sort((left, right) => playerOverall(right) - playerOverall(left))
      .slice(0, normalizedCount - picked.length)
      .forEach((card) => picked.push(card));
  }

  return picked.map((card) => card.userPlayerId);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toHorizontalPitchPosition(point: { x: number; y: number }) {
  return {
    left: `${clampNumber(point.y, 0, 100)}%`,
    top: `${clampNumber(point.x, 0, 100)}%`,
  } as CSSProperties;
}

function getPlayerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function IconShell({ children }: { children: ReactNode }) {
  return (
    <svg className="club-svg-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function ShopIcon() {
  return (
    <IconShell>
      <path
        d="M6.5 10.5h11l-1 9h-9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
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

function SparkIcon() {
  return (
    <IconShell>
      <path
        d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z" fill="currentColor" />
    </IconShell>
  );
}

function MoveIcon() {
  return (
    <IconShell>
      <path
        d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}

function GiftIcon() {
  return (
    <IconShell>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10h16v10H4zM2.5 7h19v3h-19zM12 7v13M7.5 7C5 7 4 5.8 4 4.5S5 2 6.5 2C9 2 12 7 12 7M16.5 7C19 7 20 5.8 20 4.5S19 2 17.5 2C15 2 12 7 12 7" />
      </svg>
    </IconShell>
  );
}

function PowerIcon() {
  return (
    <IconShell>
      <path d="M12 3v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M7.3 6.8a7 7 0 1 0 9.4 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
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
      <path
        d="M4.5 14.5h7.2a4 4 0 1 0 0-8H9.2l-4.7 8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 8.5h6M18 6l2 2.5-2 2.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}

function VersusIcon() {
  return (
    <IconShell>
      <path
        d="M5 6l4.2 12M10 6L5.8 18M14 6l5 6-5 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </IconShell>
  );
}
