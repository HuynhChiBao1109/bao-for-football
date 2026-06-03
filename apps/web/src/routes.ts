import { AppRoute } from './enums/routes';

export const ROUTES = {
  login: AppRoute.Login,
  adminLogin: AppRoute.AdminLogin,
  teamSetup: AppRoute.TeamSetup,
  club: AppRoute.Club,
  players: AppRoute.Players,
  tactics: AppRoute.Tactics,
  aiMatch: AppRoute.AiMatch,
  leagueMatch: AppRoute.LeagueMatch,
  championShipMatch: AppRoute.ChampionShipMatch,
  pvp: AppRoute.Pvp,
  gacha: AppRoute.Gacha,
  admin: AppRoute.Admin,
} as const;

export function defaultAuthenticatedRoute(isAdmin: boolean) {
  return isAdmin ? ROUTES.admin : ROUTES.club;
}

export function navItems(isAdmin: boolean) {
  if (isAdmin) {
    return [{ path: ROUTES.admin, label: 'Admin' }];
  }

  return [
    { path: ROUTES.club, label: 'CLB' },
    { path: ROUTES.players, label: 'Cầu thủ' },
    { path: ROUTES.tactics, label: 'Chiến thuật' },
    { path: ROUTES.aiMatch, label: 'Campaign AI' },
    { path: ROUTES.pvp, label: 'PvP' },
    { path: ROUTES.gacha, label: 'Gacha' },
  ];
}
