import { useClaimDailyLogin, type DailyLoginStatus } from '../../hooks/useDailyLogin';
import './DailyLoginPopup.css';

type DailyLoginPopupProps = {
  status?: DailyLoginStatus;
  isLoading: boolean;
  error: Error | null;
};

export function DailyLoginPopup({ status, isLoading, error }: DailyLoginPopupProps) {
  const claim = useClaimDailyLogin();
  const claimedReward = claim.data?.claimedReward;
  const visibleStatus = claim.data ?? status;

  if (isLoading && !visibleStatus) {
    return <div className="daily-login__loading">Đang đồng bộ chuỗi đăng nhập...</div>;
  }

  if (error && !visibleStatus) {
    return <div className="daily-login__message daily-login__message--error">{error.message}</div>;
  }

  if (!visibleStatus) {
    return null;
  }

  const actionText = visibleStatus.completed
    ? 'Đã hoàn tất 7 ngày'
    : visibleStatus.canClaim
      ? `Nhận quà ngày ${visibleStatus.nextDay}`
      : 'Hôm nay đã nhận thưởng';

  return (
    <div className="daily-login">
      <header className="daily-login__hero">
        <div>
          <span>REDLOCK ACCESS STREAK</span>
          <h3>7 ngày thức tỉnh</h3>
          <p>
            {visibleStatus.completed
              ? 'Chuỗi đăng nhập đã hoàn tất.'
              : visibleStatus.canClaim
                ? `Phần thưởng ngày ${visibleStatus.nextDay} đã sẵn sàng.`
                : 'Hẹn gặp lại vào ngày tiếp theo.'}
          </p>
        </div>
        <strong>
          {visibleStatus.claimedDays}
          <small>/7</small>
        </strong>
      </header>

      <div className="daily-login__grid">
        {visibleStatus.rewards.map((reward) => (
          <article
            key={reward.day}
            className="daily-login-reward"
            data-state={reward.state}
            data-type={reward.type}
          >
            <header>
              <span>Ngày {reward.day}</span>
              {reward.state === 'claimed' ? <b aria-label="Đã nhận">✓</b> : null}
            </header>

            {reward.type === 'player' ? (
              <div className="daily-login-reward__player">
                <span>{getPlayerInitials(reward.player?.name ?? reward.label)}</span>
                <small>{reward.player?.position ?? 'CF'}</small>
              </div>
            ) : (
              <div className="daily-login-reward__credits" aria-hidden="true">
                <span>R</span>
              </div>
            )}

            <strong>
              {reward.type === 'money'
                ? formatRewardMoney(reward.amount ?? 0)
                : reward.player?.name ?? reward.label}
            </strong>
            <small>{reward.type === 'money' ? 'Credits' : 'Legend Player'}</small>
          </article>
        ))}
      </div>

      {claimedReward ? (
        <div className="daily-login__message" data-type={claimedReward.type}>
          Ngày {claimedReward.day}: {claimedReward.label} đã được nhận
          {claimedReward.alreadyOwned ? ' (cầu thủ đã có trong đội)' : ''}.
        </div>
      ) : null}
      {claim.error ? (
        <div className="daily-login__message daily-login__message--error">
          {claim.error.message}
        </div>
      ) : null}

      <footer className="daily-login__footer">
        <span>Tiến độ được tính theo giờ Việt Nam</span>
        <button
          type="button"
          disabled={!visibleStatus.canClaim || claim.isPending}
          onClick={() => claim.mutate()}
        >
          <GiftMark />
          {claim.isPending ? 'Đang nhận...' : actionText}
        </button>
      </footer>
    </div>
  );
}

function getPlayerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatRewardMoney(amount: number) {
  if (amount >= 1_000_000) {
    return `${Number((amount / 1_000_000).toFixed(1))}M`;
  }
  return amount.toLocaleString('vi-VN');
}

function GiftMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v10H4zM2.5 7h19v3h-19zM12 7v13M7.5 7C5 7 4 5.8 4 4.5S5 2 6.5 2C9 2 12 7 12 7M16.5 7C19 7 20 5.8 20 4.5S19 2 17.5 2C15 2 12 7 12 7" />
    </svg>
  );
}
