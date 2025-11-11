import { vi } from 'vitest';

export function createMockStravaFetch({
  tokenResponse,
  tokenStatus = 200,
  athleteStatus = 200,
  failText = 'error',
} = {}) {
  return vi.fn(async url => {
    if (url.includes('/oauth/token')) {
      if (tokenStatus >= 200 && tokenStatus < 300) {
        return {
          ok: true,
          status: tokenStatus,
          json: async () => tokenResponse,
        };
      }
      return {
        ok: false,
        status: tokenStatus,
        text: async () => failText,
      };
    }

    if (url.includes('/api/v3/athlete')) {
      return {
        ok: athleteStatus >= 200 && athleteStatus < 300,
        status: athleteStatus,
        json: async () => ({}),
      };
    }

    throw new Error(`Unexpected Strava fetch URL: ${url}`);
  });
}
