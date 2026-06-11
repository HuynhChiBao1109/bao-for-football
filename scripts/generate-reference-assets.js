const fs = require("fs");
const path = require("path");

const COUNTRY_JSON = path.resolve(__dirname, "..", "apps", "server", "src", "database", "migrations", "country.json");
const LEAGUE_JSON = path.resolve(__dirname, "..", "apps", "server", "src", "database", "migrations", "league.json");
const WEB_PUBLIC_DIR = path.resolve(__dirname, "..", "apps", "web", "public");

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hslColor(seed, offset = 0) {
  const hue = (seed + offset) % 360;
  return `hsl(${hue} 78% 52%)`;
}

function makeInitials(name, limit = 3) {
  const parts = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  if (!parts.length) {
    return "FC";
  }

  const compact = parts
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase());

  return compact.slice(0, limit).join("");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTemplate({ kind, title, slug }) {
  const seed = hashString(slug);
  const colorA = hslColor(seed % 360, 0);
  const colorB = hslColor((seed % 360) + 34, 0);
  const colorC = hslColor((seed % 360) + 68, 0);
  const initials = makeInitials(title);
  const displayTitle = escapeXml(title);
  const accent = kind === "country" ? "M 0 62 C 46 28, 86 92, 128 62 S 210 28, 256 62 V 256 H 0 Z" : "M 42 34 H 214 V 104 C 214 166 183 208 128 236 C 73 208 42 166 42 104 Z";
  const innerShape = kind === "country" ? '<circle cx="128" cy="118" r="64" fill="rgba(255,255,255,0.13)"/>' : '<path d="M128 58 L184 78 V118 C184 162 161 192 128 209 C95 192 72 162 72 118 V78 Z" fill="rgba(255,255,255,0.13)"/>';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="${displayTitle}">
  <defs>
    <linearGradient id="bg-${slug}" x1="24" y1="20" x2="232" y2="236" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${colorA}" />
      <stop offset="0.52" stop-color="${colorB}" />
      <stop offset="1" stop-color="${colorC}" />
    </linearGradient>
    <linearGradient id="shine-${slug}" x1="40" y1="34" x2="208" y2="222" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>
  <path d="${accent}" fill="url(#bg-${slug})" />
  <path d="${accent}" fill="url(#shine-${slug})" opacity="0.42" />
  <circle cx="196" cy="58" r="28" fill="rgba(255,255,255,0.14)" />
  <circle cx="58" cy="198" r="34" fill="rgba(0,0,0,0.12)" />
  ${innerShape}
  <rect x="26" y="26" width="204" height="204" rx="38" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3" />
  <text x="128" y="140" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${kind === "country" ? 64 : 60}" font-weight="800" fill="#ffffff" letter-spacing="3">${escapeXml(initials)}</text>
  <text x="128" y="186" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="rgba(255,255,255,0.82)" letter-spacing="2">${kind === "country" ? "COUNTRY" : "CLUB"}</text>
</svg>
`;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeAsset(outputPath, content) {
  fs.writeFileSync(outputPath, content);
}

function main() {
  const countries = readJson(COUNTRY_JSON);
  const leagues = readJson(LEAGUE_JSON);

  const countryDir = path.join(WEB_PUBLIC_DIR, "countries");
  const clubDir = path.join(WEB_PUBLIC_DIR, "clubs");
  ensureDir(countryDir);
  ensureDir(clubDir);

  const seenCountries = new Map();
  for (const item of countries) {
    const name = String(item?.name || "").trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!slug || seenCountries.has(slug)) continue;
    seenCountries.set(slug, name);
    writeAsset(path.join(countryDir, `${slug}.svg`), buildTemplate({ kind: "country", title: name, slug }));
  }

  const seenClubs = new Map();
  for (const league of leagues) {
    for (const club of league.clubs || []) {
      const name = String(club?.name || "").trim();
      if (!name) continue;
      const slug = slugify(name);
      if (!slug || seenClubs.has(slug)) continue;
      seenClubs.set(slug, name);
      writeAsset(path.join(clubDir, `${slug}.svg`), buildTemplate({ kind: "club", title: name, slug }));
    }
  }

  console.log(`Generated ${seenCountries.size} country assets and ${seenClubs.size} club assets.`);
}

main();
