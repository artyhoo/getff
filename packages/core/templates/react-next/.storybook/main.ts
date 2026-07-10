import type { StorybookConfig } from '@storybook/nextjs-vite';

// Storybook 10.x: addon-essentials + addon-interactions are merged into core — no addons needed.
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
};

export default config;
