// Vitest setup — required by vitest.config.ts (setupFiles).
// Registers jest-dom matchers (expect(...).toBeInTheDocument()) and cleans up
// the DOM after every test (the config sets globals: false, so RTL does not
// auto-clean without this hook).
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
