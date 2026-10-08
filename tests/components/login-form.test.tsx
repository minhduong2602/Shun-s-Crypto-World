import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const signInWithPassword = vi.fn();
const replace = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  getClientSupabase: () => ({
    auth: { signInWithPassword },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

import { LoginForm } from '@/components/login-form';

describe('LoginForm', () => {
  it('signs in an admin-provisioned user with Supabase email and password auth', async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: 'user@example.com', password: 'correct-password' }));
    expect(replace).toHaveBeenCalledWith('/');
  });
});
