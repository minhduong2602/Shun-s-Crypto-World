'use client';

import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getClientSupabase } from '@/lib/supabase/client';

export function LoginForm() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(null); const { error: authError } = await getClientSupabase().auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }); setLoading(false); if (authError) setError(authError.message); else setSent(true); };
  return <Card className="w-full max-w-sm"><CardHeader><CardTitle>Đăng nhập</CardTitle><CardDescription>Nhận magic link qua email để vào danh mục riêng của bạn.</CardDescription></CardHeader><CardContent>{sent ? <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-400">Đã gửi magic link. Hãy kiểm tra hộp thư.</p> : <form className="grid gap-4" onSubmit={submit}><div className="grid gap-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>{error && <p className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={loading}><Mail className="size-4" />{loading ? 'Đang gửi…' : 'Gửi magic link'}</Button></form>}</CardContent></Card>;
}
