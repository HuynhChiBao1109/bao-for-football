import { API_BASE_URL } from './apiClient';

export const DEFAULT_CLUB_IMAGE = '/clubs/default-club.svg';
export const DEFAULT_COUNTRY_IMAGE = '/countries/default-country.svg';
export const DEFAULT_PLAYER_AVATAR = '/player/default-avatar.svg';

function resolveMediaUrl(value?: string | null): string {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^https?:\/\//i.test(source)) return source;
  if (source.startsWith('/')) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
}

type CountryImageSource = {
  slug?: string | null;
  flag?: string | null;
  name?: string | null;
};

type ClubImageSource = {
  slug?: string | null;
  imgUrl?: string | null;
  logo?: string | null;
  name?: string | null;
};

export function resolveCountryImage(country?: CountryImageSource | null): string {
  if (country?.slug) {
    return `/countries/${country.slug}.svg`;
  }

  return resolveMediaUrl(country?.flag) || DEFAULT_COUNTRY_IMAGE;
}

export function resolveClubImage(club?: ClubImageSource | null): string {
  if (club?.slug) {
    return `/clubs/${club.slug}.svg`;
  }

  return resolveMediaUrl(club?.imgUrl ?? club?.logo) || DEFAULT_CLUB_IMAGE;
}

export function resolveAnyImage(value?: string | null): string {
  return resolveMediaUrl(value) || DEFAULT_CLUB_IMAGE;
}
