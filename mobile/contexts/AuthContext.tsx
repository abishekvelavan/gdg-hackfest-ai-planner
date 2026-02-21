import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface User {
    user_id: string;
    email: string;
    name: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<User>;
    register: (email: string, password: string, name: string) => Promise<User>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => ({ user_id: '', email: '', name: '' }),
    register: async () => ({ user_id: '', email: '', name: '' }),
    logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Load saved user on app start
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem('user');
                if (saved) setUser(JSON.parse(saved));
            } catch (e) {
                console.error('[Auth] Failed to load user:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const login = async (email: string, password: string): Promise<User> => {
        const res = await api.login(email, password);
        if (res.status === 'error') throw new Error(res.message);
        const u = res.user as User;
        setUser(u);
        await AsyncStorage.setItem('user', JSON.stringify(u));
        return u;
    };

    const register = async (email: string, password: string, name: string): Promise<User> => {
        const res = await api.register(email, password, name);
        if (res.status === 'error') throw new Error(res.message);
        const u = res.user as User;
        setUser(u);
        await AsyncStorage.setItem('user', JSON.stringify(u));
        return u;
    };

    const logout = async () => {
        setUser(null);
        await AsyncStorage.removeItem('user');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
