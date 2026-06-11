import { API_BASE_URL } from './apiClient';

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

  return resolveMediaUrl(country?.flag) || '/app/logo.png';
}

export function resolveClubImage(club?: ClubImageSource | null): string {
  if (club?.slug) {
    return `/clubs/${club.slug}.svg`;
  }

  return resolveMediaUrl(club?.imgUrl ?? club?.logo) || '/app/logo.png';
}

export function resolveAnyImage(value?: string | null): string {
  return resolveMediaUrl(value) || '/app/logo.png';
}
