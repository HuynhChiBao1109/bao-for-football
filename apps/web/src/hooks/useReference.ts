import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { Club, ClubPlayerPreview, Country, League } from '../types';

export function useReferenceCountries(enabled: boolean) {
  return useQuery<Country[]>({
    queryKey: ['reference-countries'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/references/countries');
      return Array.isArray(payload) ? payload : [];
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useReferenceLeagues(countryId: number | null, enabled: boolean) {
  return useQuery<League[]>({
    queryKey: ['reference-leagues', countryId],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/references/leagues/${countryId}`);
      return Array.isArray(payload) ? payload : [];
    },
    enabled: enabled && Boolean(countryId),
    staleTime: 10 * 60_000,
  });
}

export function useReferenceAllLeagues(enabled: boolean) {
  return useQuery<League[]>({
    queryKey: ['reference-leagues-all'],
    queryFn: async () => {
      const payload = await apiClient('/api/v1/references/leagues');
      return Array.isArray(payload) ? payload : [];
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useReferenceClubs(leagueId: number | null, enabled: boolean) {
  return useQuery<Club[]>({
    queryKey: ['reference-clubs', leagueId],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/references/clubs/${leagueId}`);
      return Array.isArray(payload) ? payload : [];
    },
    enabled: enabled && Boolean(leagueId),
    staleTime: 10 * 60_000,
  });
}

export function useReferenceClubPlayers(clubId: number | null, enabled: boolean) {
  return useQuery<ClubPlayerPreview[]>({
    queryKey: ['reference-club-players', clubId],
    queryFn: async () => {
      const payload = await apiClient(`/api/v1/references/clubs/${clubId}/players`);
      return Array.isArray(payload) ? payload : [];
    },
    enabled: enabled && Boolean(clubId),
    staleTime: 10 * 60_000,
  });
}

export function useCreateTeamByClubMutation() {
  const { token } = useAuth();

  return useMutation<void, Error, { clubId: number }>({
    mutationFn: async ({ clubId }) => {
      await apiClient(`/api/v1/teams/club/${clubId}`, {
        method: 'POST',
        token,
      });
    },
  });
}
