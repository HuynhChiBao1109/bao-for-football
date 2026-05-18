import React, { useState } from 'react'
import './ModuleCard.css'

interface ModuleAction {
  label: string
  description: string
  icon: string
  onClick: () => void
}

interface ModuleCardProps {
  title: string
  subtitle: string
  icon: string
  actions: ModuleAction[]
  column?: 'left' | 'center' | 'right'
}

export function ModuleCard({ title, subtitle, icon, actions, column = 'left' }: ModuleCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={`module-card module-card--${column}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background effect */}
      <div className="module-card__background" />

      {/* Header with icon */}
      <div className="module-card__header">
        <div className="module-card__icon-wrapper">
          <span className="module-card__icon">{icon}</span>
        </div>
        <div>
          <p className="module-card__label">{title}</p>
          <h3 className="module-card__subtitle">{subtitle}</h3>
        </div>
      </div>

      {/* Actions list */}
      <div className={`module-card__actions ${isHovered ? 'is-expanded' : ''}`}>
        {actions.map((action, index) => (
          <ModuleCardAction
            key={action.label}
            {...action}
            isHovered={isHovered}
            delayIndex={index}
          />
        ))}
      </div>

      {/* Animated border accent */}
      <div className="module-card__border-accent" />
    </div>
  )
}

function ModuleCardAction({
  label,
  description,
  icon,
  onClick,
  delayIndex,
}: ModuleAction & { isHovered?: boolean; delayIndex: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="module-card__action"
      style={
        {
          '--delay-index': delayIndex,
        } as React.CSSProperties
      }
    >
      <div className="module-card__action-icon">{icon}</div>
      <div className="module-card__action-content">
        <p className="module-card__action-label">{label}</p>
        <p className="module-card__action-description">{description}</p>
      </div>
      <div className="module-card__action-arrow">→</div>
    </button>
  )
}
