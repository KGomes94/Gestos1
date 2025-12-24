
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, ViewState, UserRole } from '../types';
import { db } from '../services/db';

interface AuthContextType {
    user: User | null;
    login: (username: string, pass: string) => Promise<boolean>;
    logout: () => void;
    hasPermission: (view: ViewState) => boolean;
    canManageUsers: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(() => db.users.getSession());

    const login = async (username: string, pass: string): Promise<boolean> => {
        const users = db.users.getAll();
        const found = users.find(u => u.username === username && u.password === pass && u.active);
        if (found) {
            setUser(found);
            db.users.setSession(found);
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        db.users.setSession(null);
    };

    const hasPermission = (view: ViewState): boolean => {
        if (!user) return false;
        if (user.role === 'ADMIN' || user.role === 'GESTOR') return true;

        const perms: Record<UserRole, ViewState[]> = {
            'ADMIN': [], // Handled above
            'GESTOR': [], // Handled above
            'FINANCEIRO': ['dashboard', 'financeiro', 'relatorios', 'clientes', 'documentos'],
            'TECNICO': ['dashboard', 'agenda', 'materiais', 'clientes']
        };

        return perms[user.role].includes(view);
    };

    const canManageUsers = () => user?.role === 'ADMIN';

    return (
        <AuthContext.Provider value={{ user, login, logout, hasPermission, canManageUsers }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    return context;
};
