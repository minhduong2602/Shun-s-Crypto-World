import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

let RootLayout: typeof import('@/app/layout').default;

describe('RootLayout', () => {
  beforeAll(async () => {
    vi.stubGlobal('React', React);
    ({ default: RootLayout } = await import('@/app/layout'));
  });

  it('forces the shadcn dark theme for the entire application', () => {
    const layout = RootLayout({ children: <main>Dashboard</main> });

    expect(layout.props.className).toContain('dark');
  });
});
