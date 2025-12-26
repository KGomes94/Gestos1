
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ViewState, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { db } from '../services/db';

interface AuthContextType {
    user: User | null;
    login: (username: string, pass: string) => Promise<boolean>;
    logout: () => void;
    hasPermission: (view: ViewState) => boolean;
    canManageUsers: () => boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            if (!isSupabaseConfigured()) {
                // Fallback para modo local/demo se não houver chaves
                const localUser = db.users.getSession();
                if (localUser && mounted) setUser(localUser);
                if (mounted) setLoading(false);
                return;
            }

            try {
                // Timeout reduzido para 3s para evitar espera longa no arranque
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject("Timeout"), 3000));
                
                const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any;

                if (session?.user && mounted) {
                    await fetchProfile(session.user.id, session.user.email!);
                }
            } catch (error) {
                console.warn("Auth check slow or failed, proceeding as guest/login", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            
            if (event === 'SIGNED_IN' && session?.user) {
                await fetchProfile(session.user.id, session.user.email!);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string, email: string) => {
        try {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (profile) {
                setUser({
                    id: profile.id,
                    username: email, 
                    name: profile.full_name || email.split('@')[0],
                    role: profile.role as UserRole,
                    active: profile.active !== false,
                    email: email
                });
            } else {
                // Perfil ainda não criado pelo trigger? Fallback.
                setUser({
                    id: userId,
                    username: email,
                    name: email.split('@')[0],
                    role: 'TECNICO',
                    active: true,
                    email: email
                });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const login = async (email: string, pass: string): Promise<boolean> => {
        if (!isSupabaseConfigured()) {
            const users = await db.users.getAll();
            const found = users.find(u => (u.username === email || u.email === email) && u.password === pass && u.active);
            if (found) {
                setUser(found);
                db.users.setSession(found);
                return true;
            }
            return false;
        }

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: pass
            });

            if (error) {
                console.error("Login failed:", error.message);
                return false;
            }
            return true;
        } catch (err) {
            console.error("Login exception:", err);
            return false;
        }
    };

    const logout = async () => {
        // Limpar estado local IMEDIATAMENTE para UX rápida
        setUser(null);
        db.users.setSession(null);
        
        // Tentar limpar no servidor sem bloquear
        if (isSupabaseConfigured()) {
            try {
                await supabase.auth.signOut();
            } catch (e) {
                console.warn("Server logout failed, but local session cleared.");
            }
        }
    };

    const hasPermission = (view: ViewState): boolean => {
        if (!user) return false;
        if (user.role === 'ADMIN' || user.role === 'GESTOR') return true;

        const perms: Record<UserRole, ViewState[]> = {
            'ADMIN': [],
            'GESTOR': [],
            'FINANCEIRO': ['dashboard', 'financeiro', 'relatorios', 'clientes', 'documentos', 'faturacao'],
            'TECNICO': ['dashboard', 'agenda', 'materiais', 'clientes']
        };

        return perms[user.role]?.includes(view) || false;
    };

    const canManageUsers = () => user?.role === 'ADMIN';

    return (
        <AuthContext.Provider value={{ user, login, logout, hasPermission, canManageUsers, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    return context;
};
