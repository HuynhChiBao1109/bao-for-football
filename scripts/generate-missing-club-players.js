const fs = require("fs");
const path = require("path");

const FILE_PATH = path.resolve(
  __dirname,
  "..",
  "apps",
  "server",
  "src",
  "database",
  "migrations",
  "league.json",
);

const TARGET_COUNT = 11;

const FIRST_NAMES = [
  "Liam",
  "Noah",
  "Ethan",
  "Lucas",
  "Mason",
  "Oliver",
  "Jack",
  "Harry",
  "James",
  "Leo",
  "Daniel",
  "Ryan",
  "Adam",
  "Luke",
  "Aaron",
  "Ben",
  "Sam",
  "Max",
  "Tom",
  "Chris",
  "Theo",
  "Alex",
  "Hugo",
  "Luca",
  "Marco",
  "Matteo",
  "Andrea",
  "Nico",
  "Elias",
  "Jonas",
  "Milan",
  "Felix",
  "Julian",
  "David",
  "Kai",
  "Minh",
  "Quang",
  "Nam",
  "Huy",
  "An",
  "Duc",
  "Tuan",
  "Phuc",
  "Bao",
  "Long",
  "Son",
  "Duy",
  "Khoa",
  "Khanh",
  "Phong",
];

const LAST_NAMES = [
  "Smith",
  "Taylor",
  "Brown",
  "Wilson",
  "Johnson",
  "Thomas",
  "Martin",
  "Walker",
  "Wright",
  "Harris",
  "Clark",
  "Lewis",
  "Hall",
  "Young",
  "King",
  "Allen",
  "Scott",
  "Green",
  "Baker",
  "Adams",
  "Carter",
  "Evans",
  "Turner",
  "Hughes",
  "Parker",
  "White",
  "Hill",
  "Moore",
  "Ward",
  "Collins",
  "Rossi",
  "Romano",
  "Bianchi",
  "Ricci",
  "Moretti",
  "Ferrari",
  "Esposito",
  "Lombardi",
  "Nguyen",
  "Tran",
  "Le",
  "Pham",
  "Hoang",
  "Vu",
  "Dang",
  "Bui",
  "Do",
  "Phan",
  "Ngo",
  "Ly",
  "Chau",
];

const ROLE_TEMPLATES = [
  { role: "GK", positions: [["GK", 1]] },
  { role: "CB", positions: [["CB", 1], ["FB", 0.78]] },
  { role: "CB", positions: [["CB", 1]] },
  { role: "LB", positions: [["LB", 1], ["CB", 0.76]] },
  { role: "RB", positions: [["RB", 1], ["CB", 0.76]] },
  { role: "CDM", positions: [["CDM", 1], ["CM", 0.9]] },
  { role: "CM", positions: [["CM", 1], ["AM", 0.88]] },
  { role: "AM", positions: [["AM", 1], ["CM", 0.88]] },
  { role: "LW", positions: [["LW", 1], ["ST", 0.84]] },
  { role: "RW", positions: [["RW", 1], ["ST", 0.84]] },
  { role: "ST", positions: [["ST", 1], ["AM", 0.8]] },
];

const LEAGUE_BASE = {
  "Premier League": 80,
  "Ligue 1": 77,
  "La Liga": 79,
  "Serie A": 78,
  Bundesliga: 78,
  Eredivisie: 74,
  "V.League 1": 70,
};

const ROLE_BODY = {
  GK: "NORMAL",
  CB: "STOCKY",
  FB: "LEAN",
  LB: "LEAN",
  RB: "LEAN",
  CDM: "NORMAL",
  CM: "NORMAL",
  AM: "LEAN",
  LW: "LEAN",
  RW: "LEAN",
  ST: "STOCKY",
};

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function flattenPlayers(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const result = [];
  for (const item of value) {
    if (Array.isArray(item)) {
      result.push(...flattenPlayers(item));
      continue;
    }

    if (item && typeof item === "object") {
      result.push(item);
    }
  }
  return result;
}

function buildName(rng, usedNames) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const name = `${first} ${last}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const fallback = `Player ${usedNames.size + 1}`;
  usedNames.add(fallback);
  return fallback;
}

function buildStats(role, base, rng) {
  const noise = () => (rng() - 0.5) * 8;
  const field = (center, spread = 8) => clamp(center + (rng() - 0.5) * spread + noise(), 20, 96);

  if (role === "GK") {
    return {
      pass: field(base - 8, 8),
      longPass: field(base - 4, 8),
      vision: field(base - 12, 8),
      shoot: field(24, 6),
      tackle: field(28, 6),
      balance: field(base - 6, 8),
      dribbling: field(base - 18, 8),
      acceleration: field(base - 18, 8),
      speed: field(base - 18, 8),
      stamina: field(base - 10, 8),
      gkKeeping: field(base + 8, 10),
      gkReflex: field(base + 8, 10),
      gkDiving: field(base + 8, 10),
      gkReach: field(base + 8, 10),
    };
  }

  if (role === "CB") {
    return {
      pass: field(base - 2, 8),
      longPass: field(base, 8),
      vision: field(base - 4, 8),
      shoot: field(base - 18, 8),
      tackle: field(base + 8, 8),
      balance: field(base, 8),
      dribbling: field(base - 8, 8),
      acceleration: field(base - 12, 8),
      speed: field(base - 10, 8),
      stamina: field(base - 2, 8),
      gkKeeping: field(24, 6),
      gkReflex: field(24, 6),
      gkDiving: field(24, 6),
      gkReach: field(24, 6),
    };
  }

  if (role === "FB" || role === "LB" || role === "RB") {
    return {
      pass: field(base + 1, 8),
      longPass: field(base, 8),
      vision: field(base - 1, 8),
      shoot: field(base - 8, 8),
      tackle: field(base + 4, 8),
      balance: field(base + 1, 8),
      dribbling: field(base + 1, 8),
      acceleration: field(base + 6, 8),
      speed: field(base + 6, 8),
      stamina: field(base + 4, 8),
      gkKeeping: field(24, 6),
      gkReflex: field(24, 6),
      gkDiving: field(24, 6),
      gkReach: field(24, 6),
    };
  }

  if (role === "CDM" || role === "CM" || role === "AM") {
    return {
      pass: field(base + 6, 8),
      longPass: field(base + 4, 8),
      vision: field(base + 6, 8),
      shoot: field(base + 1, 8),
      tackle: field(base - 1, 8),
      balance: field(base + 3, 8),
      dribbling: field(base + 3, 8),
      acceleration: field(base + 2, 8),
      speed: field(base + 1, 8),
      stamina: field(base + 4, 8),
      gkKeeping: field(24, 6),
      gkReflex: field(24, 6),
      gkDiving: field(24, 6),
      gkReach: field(24, 6),
    };
  }

  return {
    pass: field(base + 2, 8),
    longPass: field(base, 8),
    vision: field(base + 1, 8),
    shoot: field(base + 8, 8),
    tackle: field(base - 16, 8),
    balance: field(base + 2, 8),
    dribbling: field(base + 6, 8),
    acceleration: field(base + 8, 8),
    speed: field(base + 8, 8),
    stamina: field(base + 2, 8),
    gkKeeping: field(24, 6),
    gkReflex: field(24, 6),
    gkDiving: field(24, 6),
    gkReach: field(24, 6),
  };
}

function pickSkill(role, stats, rng) {
  if (role === "GK" || rng() < 0.7) {
    return [];
  }

  const skills = [];
  if (stats.shoot >= 82 || role === "ST") {
    skills.push(1);
  }
  if (stats.dribbling >= 82 || role === "LW" || role === "RW" || role === "AM") {
    skills.push(2);
  }

  if (!skills.length && rng() < 0.4) {
    skills.push(rng() > 0.5 ? 1 : 2);
  }

  return Array.from(new Set(skills)).slice(0, 2);
}

function createPlayer({ leagueName, clubName, clubId, role, positions, index, rng, strength }) {
  const name = buildName(rng, new Set());
  const base = LEAGUE_BASE[leagueName] ?? 74;
  const clubShift = Math.round((strength - 0.5) * 8);
  const stats = buildStats(role, base + clubShift, rng);
  const skills = pickSkill(role, stats, rng);

  return {
    name,
    season: "CURRENT",
    avatarUrl: null,
    countryId: null,
    clubId,
    height: clamp(
      role === "GK"
        ? 188 + rng() * 10
        : role === "CB"
          ? 184 + rng() * 12
          : role === "ST"
            ? 178 + rng() * 14
            : 173 + rng() * 11,
      168,
      200,
    ),
    bodyType: ROLE_BODY[role] ?? "NORMAL",
    ...stats,
    positions,
    ...(skills.length ? { skills } : {}),
  };
}

function generateClubPlayers(leagueName, clubName, clubId, clubIndex, clubCount, existingPlayers) {
  const flattened = flattenPlayers(existingPlayers);
  const needed = Math.max(0, TARGET_COUNT - flattened.length);
  if (!needed) {
    return existingPlayers;
  }

  const seed = hashString(`${leagueName}:${clubName}:${clubId}`);
  const rng = mulberry32(seed);
  const generated = [];
  const usedNames = new Set(flattened.map((player) => String(player.name || "").trim()).filter(Boolean));
  const strength = clubCount <= 1 ? 0.5 : 1 - clubIndex / Math.max(1, clubCount - 1);

  for (let i = 0; i < needed; i += 1) {
    const template = ROLE_TEMPLATES[(flattened.length + i) % ROLE_TEMPLATES.length];
    const player = createPlayer({
      leagueName,
      clubName,
      clubId,
      role: template.role,
      positions: template.positions.map(([position, rating]) => ({ position, rating })),
      index: flattened.length + i,
      rng,
      strength,
    });

    let name = player.name;
    let retry = 0;
    while (usedNames.has(name) && retry < 10) {
      name = buildName(rng, usedNames);
      retry += 1;
    }
    player.name = name;
    usedNames.add(name);
    generated.push(player);
  }

  return [...flattened, ...generated];
}

function main() {
  const raw = fs.readFileSync(FILE_PATH, "utf8");
  const data = JSON.parse(raw);
  let changedClubs = 0;
  let addedPlayers = 0;

  for (const league of data) {
    const clubs = Array.isArray(league.clubs) ? league.clubs : [];
    const clubCount = clubs.length;

    clubs.forEach((club, clubIndex) => {
      const flattened = flattenPlayers(club.players);
      if (flattened.length >= TARGET_COUNT) {
        return;
      }

      const nextPlayers = generateClubPlayers(
        league.name,
        club.name,
        clubIndex + 1,
        clubIndex,
        clubCount,
        club.players,
      );

      if (JSON.stringify(nextPlayers) !== JSON.stringify(club.players)) {
        club.players = nextPlayers;
        changedClubs += 1;
        addedPlayers += Math.max(0, nextPlayers.length - flattened.length);
      }
    });
  }

  fs.writeFileSync(FILE_PATH, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Updated ${changedClubs} clubs, added ${addedPlayers} players.`);
}

main();
