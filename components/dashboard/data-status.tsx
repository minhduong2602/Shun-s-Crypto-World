import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function DataStatus({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle />
      <AlertTitle>Không thể cập nhật dữ liệu</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>Thử lại</Button>
      </AlertDescription>
    </Alert>
  );
}
