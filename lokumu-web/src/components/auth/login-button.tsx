'use client';

import { signIn, signOut } from '@/lib/auth';
import { useSession } from 'next-auth/react';

export function LoginButton() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <button disabled>Loading...</button>;
  }

  if (session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>{session.user?.email}</span>
        <button onClick={() => signOut()} style={{ padding: '0.5rem 1rem' }}>
          Logout
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={() => signIn('google')} 
      style={{ 
        padding: '0.5rem 1rem',
        background: '#4285f4',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}
    >
      Login with Google
    </button>
  );
}