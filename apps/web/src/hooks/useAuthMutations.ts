import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, redirectToLogin } from '../lib/apiClient';
import { useAuth } from './useAuth';
import type { Session } from '../types';

type Credentials = {
  username: string;
  password: string;
};

function toAuthPayload(body: Credentials) {
  return {
    userName: body.username,
    password: body.password,
  };
}

function normalizeSession(payload: any): Session {
  const user = payload?.user ?? {};
  return {
    token: String(payload?.token ?? ''),
    user: {
      id: Number(user?.id ?? 0),
      username: String(user?.username ?? user?.userName ?? ''),
      isAdmin: Boolean(user?.isAdmin),
    },
  };
}

export function useLoginMutation() {
  return useMutation<Session, Error, Credentials>({
    mutationFn: async (body) => {
      const payload = await apiClient('/api/v1/auth/login', {
        method: 'POST',
        body: toAuthPayload(body),
      });
      return normalizeSession(payload);
    },
  });
}

export function useRegisterMutation() {
  return useMutation<void, Error, Credentials & { confirmPassword?: string }>({
    mutationFn: async (body) => {
      await apiClient('/api/v1/auth/register', {
        method: 'POST',
        body: toAuthPayload(body),
      });
    },
  });
}

export function useAdminLoginMutation() {
  return useMutation<Session, Error, Credentials>({
    mutationFn: async (body) => {
      const payload = await apiClient('/admin/login', {
        method: 'POST',
        body,
      });
      return payload as Session;
    },
  });
}

export function useAssignStarterTeamMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { clubId: number }>({
    mutationFn: async ({ clubId }) => {
      if (!token) {
        redirectToLogin();
        throw new Error('Missing auth token');
      }
      await apiClient('/api/v1/auth/team', {
        method: 'POST',
        token,
        body: { clubId },
      });
    },
    onSuccess: async () => {
      if (!token) return;
      await queryClient.invalidateQueries({ queryKey: ['session', token] });
    },
  });
}
