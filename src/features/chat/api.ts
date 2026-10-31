import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getChatAdapter } from '@/api';
import type { ChatMessage, Session } from '@/api/types';

export const sessionKeys = {
  all: ['sessions'] as const,
};

export const messageKeys = {
  session: (sessionId: string) => ['messages', sessionId] as const,
};

export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.all,
    queryFn: () => getChatAdapter().listSessions(),
  });
}

export function useMessages(sessionId: string | null) {
  return useQuery({
    queryKey: messageKeys.session(sessionId ?? 'none'),
    queryFn: () => (sessionId ? getChatAdapter().listMessages(sessionId) : Promise.resolve([])),
    enabled: Boolean(sessionId),
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => getChatAdapter().createSession(title),
    onSuccess: (session) => {
      queryClient.setQueryData<Session[]>(sessionKeys.all, (current = []) => [session, ...current]);
      queryClient.setQueryData<ChatMessage[]>(messageKeys.session(session.id), []);
    },
  });
}

export function useRenameSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, title }: { sessionId: string; title: string }) =>
      getChatAdapter().renameSession(sessionId, title),
    onSuccess: (session) => {
      queryClient.setQueryData<Session[]>(sessionKeys.all, (current = []) =>
        current
          .map((item) => (item.id === session.id ? session : item))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => getChatAdapter().deleteSession(sessionId),
    onSuccess: (_result, sessionId) => {
      queryClient.setQueryData<Session[]>(sessionKeys.all, (current = []) =>
        current.filter((item) => item.id !== sessionId),
      );
      queryClient.removeQueries({ queryKey: messageKeys.session(sessionId) });
    },
  });
}
