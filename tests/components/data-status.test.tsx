import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataStatus } from '@/components/dashboard/data-status';

describe('DataStatus', () => {
  it('shows a shadcn error alert with a retry action when refresh fails', () => {
    const retry = vi.fn();
    render(<DataStatus error="Supabase is unavailable" onRetry={retry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Supabase is unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders nothing when there is no current data error', () => {
    const { container } = render(<DataStatus error={null} onRetry={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
