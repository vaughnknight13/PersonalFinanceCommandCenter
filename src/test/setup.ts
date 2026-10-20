import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without this, rendered components pile up in the fake DOM between tests.
afterEach(() => {
  cleanup();
});