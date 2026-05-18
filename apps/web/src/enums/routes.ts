export const AppRoute = {
  Login: '/login',
  AdminLogin: '/admin/login',
  Club: '/club',
  Players: '/players',
  Tactics: '/tactics',
  AiMatch: '/match/ai',
  Pvp: '/match/pvp',
  Gacha: '/gacha',
  Admin: '/admin',
} as const;

export type AppRoute = (typeof AppRoute)[keyof typeof AppRoute];
