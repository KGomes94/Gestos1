
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

    useEffect(() => {
        const init = async () => {
            try {
                await driveService.initClient();
                if (driveService.isSignedIn()) {
                    const profile = driveService.getUserProfile();
                    if (profile) {
                        setUser({
                            id: profile.getId(),
                            name: profile.getName(),
                            email: profile.getEmail(),
                            username: profile.getEmail(),
                            role: 'ADMIN', // Owner do Drive é sempre Admin
                            active: true
                        });
                        await db.init(); // Carregar dados do Drive
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
        try {
            const profile = await driveService.signIn();
            
            if (profile) {
                setUser({
                    id: profile.getId(),
                    name: profile.getName(),
                    email: profile.getEmail(),
                    username: profile.getEmail(),
                    role: 'ADMIN',
                    active: true
                });
                setLoading(true);
                
                try {
                    await db.init();
                } catch (dbError) {
                    console.error("Erro ao carregar base de dados:", dbError);
                    alert("Aviso: Não foi possível carregar os dados do Drive. A iniciar com base de dados vazia.");
                }
            }
        } catch (e) {
            console.error("Login Failed", e);
            alert("O login falhou ou foi cancelado. Por favor tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        await driveService.signOut();
        setUser(null);
        window.location.reload();
    };

    const hasPermission = (view: ViewState) => true; // Admin tem tudo
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
