import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/hooks/useAuth';

export function ProtectedRoute({ children }: {children: ReactNode;}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div data-ev-id="ev_9c2fedb16a" className="flex min-h-[60vh] items-center justify-center">
				<div data-ev-id="ev_483fe471f3" className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
			</div>);

  }
  if (!user) return null;
  return <>{children}</>;
}