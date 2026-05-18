import './ClubHeader.css'

interface ClubHeaderProps {
  clubName: string
  clubLogo?: string
  budget: number
  rankPoint: number
}

export function ClubHeader({ clubName, clubLogo, budget, rankPoint }: ClubHeaderProps) {
  return (
    <div className="club-header">
      {/* Background effects */}
      <div className="club-header__background">
        <div className="club-header__glow club-header__glow--1" />
        <div className="club-header__glow club-header__glow--2" />
      </div>

      <div className="club-header__content">
        {/* Logo section */}
        <div className="club-header__logo-section">
          <div className="club-header__logo-wrapper">
            {clubLogo ? (
              <img
                src={clubLogo}
                alt={clubName}
                className="club-header__logo"
              />
            ) : (
              <div className="club-header__logo-placeholder">🏆</div>
            )}
          </div>
          <div>
            <p className="club-header__label">Your Club</p>
            <h1 className="club-header__name">{clubName}</h1>
          </div>
        </div>

        {/* Stats grid */}
        <div className="club-header__stats">
          <StatItem icon="💰" label="Budget" value={Number(budget).toLocaleString()} />
          <StatItem icon="⭐" label="Rank" value={`#${rankPoint}`} />
        </div>
      </div>

      {/* Decorative border */}
      <div className="club-header__border" />
    </div>
  )
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string
}) {
  return (
    <div className="club-header__stat-item">
      <div className="club-header__stat-icon">{icon}</div>
      <div>
        <p className="club-header__stat-label">{label}</p>
        <p className="club-header__stat-value">{value}</p>
      </div>
    </div>
  )
}
