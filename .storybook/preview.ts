/** Initialize the same translations and styles used by the app in isolated browser previews. */
import type { Preview } from '@storybook/react-vite';
import '../src/i18n';
import '../src/styles/app.css';

const preview = {} satisfies Preview;

export default preview;
