import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function useAdminAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, is_admin')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile:', error);
        setProfile(null);
        return null;
      }

      setProfile(data || null);
      return data || null;
    } catch (err) {
      console.error('Unexpected profile load error:', err);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      setLoading(true);

      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        setSession(currentSession);

        if (currentSession?.user?.id) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Failed to initialize admin auth:', err);
        if (isMounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;

      setLoading(true);
      setSession(nextSession);

      Promise.resolve()
        .then(async () => {
          if (nextSession?.user?.id) {
            await loadProfile(nextSession.user.id);
          } else {
            setProfile(null);
          }
        })
        .catch((err) => {
          console.error('Failed during auth state change:', err);
          setProfile(null);
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Failed to sign out:', err);
    } finally {
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  };

  return {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: !!profile?.is_admin,
    loading,
    signOut,
  };
}
