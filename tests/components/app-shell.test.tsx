import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '@/components/app-shell';

describe('AppShell', () => {
  it('renders the portfolio navigation and mobile navigation trigger', () => {
    render(
      <AppShell activeTab="portfolio" onTabChange={() => {}} title="Danh mục">
        <p>Nội dung</p>
      </AppShell>
    );

    expect(screen.getAllByRole('button', { name: 'Danh mục' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Thị trường' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Biểu đồ' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Ví' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Mở điều hướng' })).toBeInTheDocument();
  });
});
