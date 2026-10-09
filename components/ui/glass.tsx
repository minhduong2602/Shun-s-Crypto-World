import * as React from 'react';
import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonProps } from '@/components/ui/button';

/** A deliberately selective glass surface for primary dashboard focal points. */
export const GlassCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <section ref={ref} className={cn('glass-panel rounded-2xl text-card-foreground', className)} {...props} />
));
GlassCard.displayName = 'GlassCard';

export const GlassButton = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'default', size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), 'shadow-lg shadow-primary/10', className)} {...props} />
));
GlassButton.displayName = 'GlassButton';
