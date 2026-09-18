import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';

describe('production vendor chunks', () => {
  it('keeps React isolated from React-dependent UI libraries', async () => {
    if (typeof viteConfig !== 'function') throw new Error('Expected config factory');
    const config = await viteConfig({ command: 'build', mode: 'production' });
    const output = config.build?.rollupOptions?.output;
    if (!output || Array.isArray(output)) throw new Error('Expected one output config');
    const chunk = output.manualChunks as (id: string) => string | undefined;
    expect(output.onlyExplicitManualChunks).toBe(true);
    expect(chunk('/node_modules/react/index.js')).toBe('vendor-react');
    expect(chunk('/node_modules/react-dom/client.js')).toBe('vendor-react');
    expect(chunk('/node_modules/react-router/dist/production/index.js')).toBe('vendor-react');
    expect(
      chunk('/node_modules/@floating-ui/react-dom/dist/floating-ui.react-dom.mjs'),
    ).toBeUndefined();
    expect(chunk('/node_modules/@radix-ui/react-slot/dist/index.mjs')).toBe('vendor-radix');
  });
});
