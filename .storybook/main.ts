/** Discover adjacent component stories for the developer-only Storybook site. */
import type { StorybookConfig } from '@storybook/react-vite';

const config = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
} satisfies StorybookConfig;

export default config;
