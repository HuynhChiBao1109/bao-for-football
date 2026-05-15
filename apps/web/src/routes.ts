export const ROUTES = {
  login: "/login",
  club: "/club",
  players: "/players",
  tactics: "/tactics",
  aiMatch: "/match/ai",
  pvp: "/match/pvp",
  gacha: "/gacha",
  admin: "/admin",
};

export function defaultAuthenticatedRoute() {
  return ROUTES.club;
}

export function normalizeAuthenticatedRoute(
  pathname: string,
  isAdmin: boolean,
) {
  if (!pathname || pathname === "/" || pathname === ROUTES.login) {
    return defaultAuthenticatedRoute();
  }

  const allowed = new Set([
    ROUTES.club,
    ROUTES.players,
    ROUTES.tactics,
    ROUTES.aiMatch,
    ROUTES.pvp,
    ROUTES.gacha,
  ]);

  if (isAdmin) {
    allowed.add(ROUTES.admin);
  }

  return allowed.has(pathname) ? pathname : defaultAuthenticatedRoute();
}

export function navItems(isAdmin: boolean) {
  const items = [
    { path: ROUTES.club, label: "Quản lí đội bóng" },
    { path: ROUTES.players, label: "Quản lí cầu thủ" },
    { path: ROUTES.tactics, label: "Chiến thuật" },
    { path: ROUTES.aiMatch, label: "Đấu với máy" },
    { path: ROUTES.pvp, label: "Đấu với người" },
    { path: ROUTES.gacha, label: "Gacha cầu thủ" },
  ];

  if (isAdmin) {
    items.push({ path: ROUTES.admin, label: "Quản lí cầu thủ" });
  }

  return items;
}
