export const ROUTES = {
  login: '/login',
  club: '/club',
  players: '/players',
  tactics: '/tactics',
  aiMatch: '/match/ai',
  pvp: '/match/pvp',
  gacha: '/gacha',
  admin: '/admin',
}

export function defaultAuthenticatedRoute(isAdmin: boolean) {
  return isAdmin ? ROUTES.admin : ROUTES.club
}

export function navItems(isAdmin: boolean) {
  if (isAdmin) {
    return [{ path: ROUTES.admin, label: 'Admin' }]
  }

  return [
    { path: ROUTES.club, label: 'CLB' },
    { path: ROUTES.players, label: 'Cầu thủ' },
    { path: ROUTES.tactics, label: 'Chiến thuật' },
    { path: ROUTES.aiMatch, label: 'Campaign AI' },
    { path: ROUTES.pvp, label: 'PvP' },
    { path: ROUTES.gacha, label: 'Gacha' },
  ]
}
