import { beforeEach, vi } from 'vitest';

// Every test must explicitly inject a provider or mock fetch. Fail closed otherwise.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('External network disabled in support tests');
  }));
});
