export type DailyLoginPlayerReward = {
  day: number;
  type: "player";
  playerSlug: string;
  label: string;
};

export type DailyLoginMoneyReward = {
  day: number;
  type: "money";
  amount: number;
  label: string;
};

export type DailyLoginReward = DailyLoginPlayerReward | DailyLoginMoneyReward;

export const DAILY_LOGIN_REWARDS: readonly DailyLoginReward[] = [
  { day: 1, type: "player", playerSlug: "loki", label: "Loki" },
  { day: 2, type: "money", amount: 1_000_000, label: "1,000,000" },
  { day: 3, type: "money", amount: 1_500_000, label: "1,500,000" },
  { day: 4, type: "money", amount: 2_000_000, label: "2,000,000" },
  { day: 5, type: "money", amount: 3_000_000, label: "3,000,000" },
  { day: 6, type: "money", amount: 5_000_000, label: "5,000,000" },
  {
    day: 7,
    type: "player",
    playerSlug: "isagi-yoichi",
    label: "Isagi Yoichi",
  },
] as const;

export const DAILY_LOGIN_TIME_ZONE = "Asia/Bangkok";
