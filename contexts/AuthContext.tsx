
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ViewState } from '../types';
import { db } from '../services/db';
import { driveService } from '../services/googleDriveService';

interface AuthContextType {
    user: User | null;
    login: () => Promise<void>;
    logout: () => void;
    hasPermission: (view: ViewState) => boolean;
    canManageUsers: () => boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Initial Check
    useEffect(() => {
        const init = async () => {
            try {
                await driveService.initClient();
                if (driveService.isSignedIn()) {
                    const profile = driveService.getUserProfile();
                    if (profile) {
                        // Optimistic Set User
                        const userData = {
                            id: profile.getId(),
                            name: profile.getName(),
                            email: profile.getEmail(),
                            username: profile.getEmail(),
                            role: 'ADMIN',
                            active: true
                        };
                        
                        // CRITICAL: Await DB Init BEFORE setting loading to false
                        console.log("Auth: Loading DB...");
                        await db.init();
                        
                        setUser(userData as any);
                    }
                }
            } catch (e) {
                console.error("Auth Init Error", e);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    const login = async () => {
        setLoading(true);
        try {
            const profile = await driveService.signIn();
            
            if (profile) {
                const userData = {
                    id: profile.getId(),
                    name: profile.getName(),
                    email: profile.getEmail(),
                    username: profile.getEmail(),
                    role: 'ADMIN',
                    active: true
                };

                // CRITICAL: Load data immediately after login
                console.log("Auth: Fetching fresh data...");
                await db.init();
                
                setUser(userData as any);
            }
        } catch (e: any) {
            console.error("Login Failed", e);
            const errorMsg = e?.error || (typeof e === 'object' ? JSON.stringify(e) : String(e));
            alert(`Erro no login: ${errorMsg}\nPor favor tente novamente.`);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await driveService.signOut();
        setUser(null);
        // Force reload to clear all memory states
        window.location.reload();
    };

    const hasPermission = (view: ViewState) => true; 
    const canManageUsers = () => true;

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
