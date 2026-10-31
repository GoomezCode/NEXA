import { QueryClient } from '@tanstack/react-query';

import { shouldRetryRequest } from '@/api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetryRequest,
      refetchOnWindowFocus: false,
    },
  },
});
