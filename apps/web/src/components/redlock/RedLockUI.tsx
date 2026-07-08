import type { ReactNode } from 'react';

type Tone = 'red' | 'dark' | 'success' | 'warning' | 'muted';

type StatBarProps = {
  label: string;
  value: number;
  max?: number;
  hint?: string;
};

type StatusBadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

type HeroProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  cta?: ReactNode;
  meta?: ReactNode;
};

type PlayerCardProps = {
  name: string;
  position?: string;
  rating?: number | string;
  avatarUrl?: string;
  badges?: string[];
  stats?: Array<{ label: string; value: number }>;
  action?: ReactNode;
};

type MatchCardProps = {
  stage: string;
  opponent: string;
  reward?: string;
  status?: ReactNode;
  action?: ReactNode;
};

type RankingRow = {
  rank: number;
  name: string;
  score: number | string;
  winRate?: string;
  goals?: number | string;
};

export function AnimatedBackground() {
  return (
    <div className="redlock-bg" aria-hidden="true">
      <div className="redlock-bg__grid" />
      <div className="redlock-bg__scan" />
      <div className="redlock-bg__flare redlock-bg__flare--left" />
      <div className="redlock-bg__flare redlock-bg__flare--right" />
    </div>
  );
}

export function StatusBadge({ children, tone = 'red', className = '' }: StatusBadgeProps) {
  return (
    <span className={`redlock-badge redlock-badge--${tone} ${className}`.trim()}>
      {children}
    </span>
  );
}

export function StatBar({ label, value, max = 100, hint }: StatBarProps) {
  const safeMax = Math.max(1, max);
  const normalized = Math.max(0, Math.min(100, (Number(value) / safeMax) * 100));

  return (
    <div className="redlock-statbar">
      <div className="redlock-statbar__top">
        <span>{label}</span>
        <strong>{Math.round(value)}</strong>
      </div>
      <div className="redlock-statbar__track">
        <span style={{ width: `${normalized}%` }} />
      </div>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function RedLockHero({ kicker = 'RedLock Academy', title, subtitle, cta, meta }: HeroProps) {
  return (
    <section className="redlock-hero">
      <div className="redlock-hero__content">
        <p className="game-header-kicker">{kicker}</p>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
        {cta ? <div className="redlock-hero__actions">{cta}</div> : null}
      </div>
      {meta ? <div className="redlock-hero__meta">{meta}</div> : null}
    </section>
  );
}

export function PlayerCard({
  name,
  position = 'FW',
  rating = '--',
  avatarUrl = '/default-avatar.svg',
  badges = [],
  stats = [],
  action,
}: PlayerCardProps) {
  return (
    <article className="redlock-player-card">
      <div className="redlock-player-card__head">
        <img src={avatarUrl} alt={name} />
        <div>
          <p>{position}</p>
          <h3>{name}</h3>
        </div>
        <strong>{rating}</strong>
      </div>
      {badges.length > 0 ? (
        <div className="redlock-player-card__badges">
          {badges.map((badge) => (
            <StatusBadge key={badge} tone="dark">
              {badge}
            </StatusBadge>
          ))}
        </div>
      ) : null}
      {stats.length > 0 ? (
        <div className="redlock-player-card__stats">
          {stats.map((item) => (
            <StatBar key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      ) : null}
      {action ? <div className="redlock-player-card__action">{action}</div> : null}
    </article>
  );
}

export function MatchCard({ stage, opponent, reward, status, action }: MatchCardProps) {
  return (
    <article className="redlock-match-card">
      <div>
        <p>{stage}</p>
        <h3>{opponent}</h3>
      </div>
      {status ? <div>{status}</div> : null}
      {reward ? <span>{reward}</span> : null}
      {action ? <div className="redlock-match-card__action">{action}</div> : null}
    </article>
  );
}

export function RankingBoard({ rows }: { rows: RankingRow[] }) {
  return (
    <div className="redlock-ranking">
      {rows.map((row) => (
        <div key={`${row.rank}-${row.name}`} className="redlock-ranking__row" data-top={row.rank === 1}>
          <strong>#{row.rank}</strong>
          <span>{row.name}</span>
          <small>{row.winRate ?? '0%'} WR</small>
          <small>{row.goals ?? 0} G</small>
          <b>{row.score}</b>
        </div>
      ))}
    </div>
  );
}

export function SkillPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="redlock-skill-panel">
      <p className="game-header-kicker">{title}</p>
      <div>{children}</div>
    </section>
  );
}

export function TrainingZone({ children }: { children: ReactNode }) {
  return <section className="redlock-training-zone">{children}</section>;
}
