import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  loginAsDevAdmin: () => void;
}

const DEV_USER: User = {
  id: 'be8d34d1-0299-4ab8-8c0a-a163a06c78ed',
  app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Admin AXX09', role: 'SUPER_ADMIN' },
  aud: 'authenticated',
  confirmation_sent_at: '',
  recovery_sent_at: '',
  email_change_sent_at: '',
  new_email: '',
  invited_at: '',
  action_link: '',
  email: 'axx09@bdiq.com',
  phone: '',
  created_at: '2026-10-06T16:06:54.705164Z',
  confirmed_at: '2026-10-06T16:06:54.705164Z',
  email_confirmed_at: '2026-10-06T16:06:54.705164Z',
  last_sign_in_at: new Date().toISOString(),
  role: 'authenticated',
  updated_at: new Date().toISOString(),
  identities: [],
  is_anonymous: false,
};

const DEV_SESSION: Session = {
  access_token: 'dev-admin-token',
  token_type: 'bearer',
  expires_in: 86400,
  refresh_token: 'dev-admin-refresh',
  user: DEV_USER,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  loginAsDevAdmin: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const isDev = localStorage.getItem('bdiq_dev_session') === 'true';
      if (isDev) {
        setSession(DEV_SESSION);
        setUser(DEV_USER);
        setLoading(false);
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error fetching session:', error);
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          localStorage.removeItem('bdiq_dev_session');
          setSession(session);
          setUser(session?.user ?? null);
        } else if (localStorage.getItem('bdiq_dev_session') === 'true') {
          setSession(DEV_SESSION);
          setUser(DEV_USER);
        } else {
          setSession(null);
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const loginAsDevAdmin = () => {
    localStorage.setItem('bdiq_dev_session', 'true');
    setSession(DEV_SESSION);
    setUser(DEV_USER);
  };

  const signOut = async () => {
    localStorage.removeItem('bdiq_dev_session');
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, loginAsDevAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
