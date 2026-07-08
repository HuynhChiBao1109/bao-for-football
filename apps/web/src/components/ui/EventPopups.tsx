import { useState } from 'react';

type EventInfo = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  reward: string;
  detail: string;
};

const EVENTS: EventInfo[] = [
  {
    id: 'ego-rush',
    icon: '⚡',
    title: 'EGO RUSH',
    subtitle: '20:00 - 22:00 mỗi ngày',
    reward: '300 energy + 1 booster',
    detail: 'Hoan thanh 5 match lien tiep de mo buff toc do va tile cau thu hiem.',
  },
  {
    id: 'rival-break',
    icon: '🔥',
    title: 'RIVAL BREAK',
    subtitle: 'Lien server cuoi tuan',
    reward: 'Rank coin + avatar frame',
    detail: 'PvP chuoi tran de lay diem bang va mo booster chien thuat theo mua.',
  },
  {
    id: 'flow-night',
    icon: '🌌',
    title: 'FLOW NIGHT',
    subtitle: 'Quest ngay reset 05:00',
    reward: 'Ve gacha dac biet',
    detail: 'Lam chuoi quest de day pity nhanh va mo banner gioi han trong ngay.',
  },
];

void EVENTS;

export function EventPopups() {
  const [activeEvent, setActiveEvent] = useState<EventInfo | null>(null);

  return (
    <>
      {/* <aside className="wuxia-events" aria-label="Su kien noi bat">
        <p className="wuxia-events__title">RedLock Events</p>
        <div className="wuxia-events__list">
          {EVENTS.map((event, index) => (
            <button
              key={event.id}
              type="button"
              className="wuxia-event-chip"
              style={{ '--event-index': index } as CSSProperties}
              onClick={() => setActiveEvent(event)}
            >
              <span className="wuxia-event-chip__icon" aria-hidden="true">
                {event.icon}
              </span>
              <span className="wuxia-event-chip__text">
                <strong>{event.title}</strong>
                <small>{event.subtitle}</small>
              </span>
              <span className="wuxia-event-chip__spark" aria-hidden="true" />
            </button>
          ))}
        </div>
      </aside> */}

      {activeEvent && (
        <div className="game-modal-backdrop" onClick={() => setActiveEvent(null)}>
          <article
            className="game-modal-card game-panel game-panel--accent wuxia-event-modal"
            role="dialog"
            aria-modal="true"
            aria-label={activeEvent.title}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="game-panel__content">
              <div className="wuxia-event-modal__header">
                <div>
                  <p className="game-header-kicker">Event Popup</p>
                  <h3 className="game-title wuxia-event-modal__title">{activeEvent.title}</h3>
                </div>
                <button
                  type="button"
                  className="game-button-ghost"
                  onClick={() => setActiveEvent(null)}
                >
                  Dong
                </button>
              </div>

              <div className="wuxia-event-modal__body">
                <img
                  src="/app/logo.png"
                  alt="Event crest"
                  className="wuxia-event-modal__logo"
                  loading="lazy"
                />
                <div>
                  <p className="wuxia-event-modal__subtitle">{activeEvent.subtitle}</p>
                  <p className="wuxia-event-modal__reward">{activeEvent.reward}</p>
                  <p className="game-copy">{activeEvent.detail}</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

