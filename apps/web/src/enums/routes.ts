export const AppRoute = {
  Login: '/login',
  AdminLogin: '/admin/login',
  TeamSetup: '/team-setup',
  Club: '/club',
  Players: '/players',
  Tactics: '/tactics',
  AiMatch: '/match/ai',
  Pvp: '/match/pvp',
  Gacha: '/gacha',
  Admin: '/admin',
  LeagueMatch: '/match/league',
  ChampionShipMatch: '/match/championship',
} as const;

export type AppRoute = (typeof AppRoute)[keyof typeof AppRoute];
