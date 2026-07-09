import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { usePlayerCards } from '../hooks/usePlayerCards';
import { API_BASE_URL } from '../lib/apiClient';
import {
  DEFAULT_CLUB_IMAGE,
  DEFAULT_COUNTRY_IMAGE,
  DEFAULT_PLAYER_AVATAR,
  resolveClubImage,
  resolveCountryImage,
} from '../lib/referenceImage';
import type { UserPlayerCard } from '../types';
import type { StatKey } from '../lib/constants';

const STAT_LABELS: Record<StatKey, string> = {
  shooting: 'Shooting',
  passing: 'Short Pass',
  longPass: 'Long Pass',
  vision: 'Vision',
  attackingAwareness: 'Attack Sense',
  defensiveAwareness: 'Defense Sense',
  duels: 'Duels',
  pace: 'Top Speed',
  stamina: 'Stamina',
  balance: 'Balance',
  technique: 'Technique',
  determination: 'Composure',
  strength: 'Power',
  standingTackle: 'Tackling',
  slidingTackle: 'Sliding Tackle',
  dribbling: 'Dribbling',
  curve: 'Curve',
  gkParrying: 'Save',
  gkReflex: 'GK Reaction',
  gkReach: 'GK Reach',
};

const STAT_GROUPS: Array<{ title: string; items: StatKey[] }> = [
  { title: 'Kick', items: ['shooting', 'passing', 'longPass', 'curve', 'vision', 'technique'] },
  {
    title: 'Physical',
    items: ['stamina', 'pace', 'balance', 'strength', 'duels', 'determination'],
  },
  {
    title: 'Mental',
    items: ['attackingAwareness', 'defensiveAwareness', 'vision', 'determination', 'technique'],
  },
  {
    title: 'Technique',
    items: ['dribbling', 'technique', 'standingTackle', 'slidingTackle', 'passing', 'curve'],
  },
  { title: 'GK', items: ['gkParrying', 'gkReflex', 'gkReach'] },
];

const RADAR_AXES: Array<{ key: string; label: string; items: StatKey[] }> = [
  { key: 'speed', label: 'Speed', items: ['pace', 'stamina'] },
  {
    key: 'defense',
    label: 'Defense',
    items: ['defensiveAwareness', 'standingTackle', 'slidingTackle'],
  },
  { key: 'pass', label: 'Pass', items: ['passing', 'longPass', 'vision'] },
  { key: 'dribble', label: 'Dribble', items: ['dribbling', 'technique', 'balance'] },
  { key: 'shoot', label: 'Shoot', items: ['shooting', 'curve', 'attackingAwareness'] },
  { key: 'offense', label: 'Offense', items: ['shooting', 'attackingAwareness', 'pace'] },
];

function resolveMediaUrl(value: string | undefined | null): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
}

function resolvePlayerAvatarUrl(card: UserPlayerCard): string {
  return resolveMediaUrl(card.imageUrl || card.avatarUrl) || DEFAULT_PLAYER_AVATAR;
}

function stat(card: UserPlayerCard, key: StatKey): number {
  return Number(card.totalStats?.[key] ?? 0);
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function rank(value: number): string {
  if (value >= 90) return 'S';
  if (value >= 80) return 'A';
  if (value >= 70) return 'B';
  if (value >= 60) return 'C';
  if (value >= 50) return 'D';
  if (value >= 40) return 'E';
  return 'F';
}

function radarPoint(index: number, total: number, value: number): string {
  const angle = -90 + (360 / total) * index;
  const radius = Math.max(12, Math.min(100, value)) * 0.42;
  const rad = (angle * Math.PI) / 180;
  const x = 50 + Math.cos(rad) * radius;
  const y = 50 + Math.sin(rad) * radius;
  return `${x.toFixed(2)}% ${y.toFixed(2)}%`;
}

export function PlayerDetailPopup({
  userPlayerId,
  onClose,
}: {
  userPlayerId: number | string;
  onClose: () => void;
}) {
  const { data: cards = [], isLoading, error } = usePlayerCards();
  const card = useMemo(
    () => cards.find((item) => String(item.userPlayerId) === String(userPlayerId)),
    [cards, userPlayerId],
  );

  return (
    <div
      className="game-modal-backdrop player-detail-popup-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="player-detail-popup-card game-scroll">
        <PlayerDetailSheet
          card={card}
          isLoading={isLoading}
          error={error as Error | null}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

export function PlayerDetailPage() {
  const { userPlayerId } = useParams();
  const { data: cards = [], isLoading, error } = usePlayerCards();
  const card = useMemo(
    () => cards.find((item) => String(item.userPlayerId) === String(userPlayerId)),
    [cards, userPlayerId],
  );

  return <PlayerDetailSheet card={card} isLoading={isLoading} error={error as Error | null} />;
}

export function PlayerDetailSheet({
  card,
  isLoading,
  error,
  onClose,
}: {
  card?: UserPlayerCard;
  isLoading?: boolean;
  error?: Error | null;
  onClose?: () => void;
}) {
  const radar = useMemo(() => {
    if (!card) return [];
    return RADAR_AXES.map((axis) => ({
      ...axis,
      value: average(axis.items.map((key) => stat(card, key))),
    }));
  }, [card]);

  const radarPolygon = radar
    .map((item, index) => radarPoint(index, radar.length, item.value))
    .join(', ');
  const total = card ? average(Object.values(card.totalStats || {}).map(Number)) : 0;
  const primaryPosition = card?.positions?.[0]?.position || 'FW';

  if (isLoading) {
    return <p className="game-notice game-notice--muted">Loading player detail...</p>;
  }

  if (error) {
    return <p className="game-notice game-notice--error">{(error as Error).message}</p>;
  }

  if (!card) {
    return (
      <section className="game-panel p-5">
        <div className="game-panel__content">
          <p className="game-notice game-notice--muted">Player not found.</p>
          {onClose ? (
            <button type="button" onClick={onClose} className="game-button-secondary mt-4">
              Close
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="redlock-detail-sheet">
      <div className="redlock-detail-sheet__top">
        <div>
          <p className="redlock-detail-kana">RedLock Ego Profile</p>
          <h1>{card.name}</h1>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="redlock-detail-back">
            Close
          </button>
        ) : null}
      </div>

      <div className="redlock-detail-grid">
        <aside className="redlock-detail-id">
          <div className="redlock-detail-id__portrait">
            <img
              src={resolvePlayerAvatarUrl(card)}
              alt={card.name}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = DEFAULT_PLAYER_AVATAR;
              }}
            />
          </div>
          <div className="redlock-detail-id__plate">
            <span>{primaryPosition}</span>
            <strong>{total}</strong>
            <b>{rank(total)}</b>
          </div>
          <div className="redlock-detail-meta">
            <img
              src={resolveClubImage({
                slug: card.clubSlug,
                imgUrl: card.clubImage,
                name: card.baseClub,
              })}
              alt={card.baseClub || 'Club'}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = DEFAULT_CLUB_IMAGE;
              }}
            />
            <span>{card.baseClub || 'Unknown Club'}</span>
          </div>
          <div className="redlock-detail-meta">
            <img
              src={resolveCountryImage(card.country)}
              alt={card.country?.name || 'Country'}
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = DEFAULT_COUNTRY_IMAGE;
              }}
            />
            <span>{card.country?.name || 'Unknown Country'}</span>
          </div>
        </aside>

        <div className="redlock-detail-radar">
          <div className="redlock-detail-radar__circle">
            <div className="redlock-detail-radar__web" />
            <div
              className="redlock-detail-radar__shape"
              style={{ clipPath: `polygon(${radarPolygon})` }}
            />
            {radar.map((axis, index) => (
              <div
                key={axis.key}
                className="redlock-detail-radar__axis"
                style={{ '--axis-angle': `${(360 / radar.length) * index}deg` } as CSSProperties}
              >
                <span>{axis.label}</span>
                <strong>{rank(axis.value)}</strong>
              </div>
            ))}
            <div className="redlock-detail-radar__core">
              <span>Total</span>
              <strong>{total}</strong>
            </div>
          </div>
        </div>

        <div className="redlock-detail-stats">
          {STAT_GROUPS.map((group) => (
            <section key={group.title} className="redlock-detail-stat-block">
              <h2>{group.title}</h2>
              <div className="redlock-detail-stat-list">
                {group.items.map((key) => (
                  <div key={key} className="redlock-detail-stat-row">
                    <span>{STAT_LABELS[key]}</span>
                    <strong>{stat(card, key)}</strong>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
