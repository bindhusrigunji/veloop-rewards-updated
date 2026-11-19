import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, User, WalletBalances, DBStatus } from '../services/api';

interface AuthContextType {
  user: User | null;
  wallet: WalletBalances | null;
  token: string | null;
  isLoading: boolean;
  dbStatus: DBStatus | null;
  isWheelModalOpen: boolean;
  setIsWheelModalOpen: (open: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => void;
  refreshWallet: () => Promise<void>;
  refreshDbStatus: () => Promise<void>;
  claimDailyReward: () => Promise<{ success: boolean; message: string }>;
  quickLogin: (type: 'user' | 'admin') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<WalletBalances | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('veloop_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbStatus, setDbStatus] = useState<DBStatus | null>(null);
  const [isWheelModalOpen, setIsWheelModalOpen] = useState<boolean>(false);

  const fetchHealthAndDb = useCallback(async () => {
    try {
      const res = await api.getHealth();
      setDbStatus(res.database);
    } catch {
      // non-blocking
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!localStorage.getItem('veloop_token')) return;
    try {
      const res = await api.getWallet();
      if (res.success && res.wallet) {
        setWallet(res.wallet);
      }
    } catch (err) {
      console.log('Error refreshing wallet:', err);
    }
  }, []);

  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    await fetchHealthAndDb();
    const storedToken = localStorage.getItem('veloop_token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        await refreshWallet();
      } else {
        localStorage.removeItem('veloop_token');
        setToken(null);
        setUser(null);
      }
    } catch {
      localStorage.removeItem('veloop_token');
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [fetchHealthAndDb, refreshWallet]);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    if (res.token && res.user) {
      localStorage.setItem('veloop_token', res.token);
      setToken(res.token);
      setUser(res.user);
      await refreshWallet();
    }
  };

  const register = async (name: string, email: string, password: string, referralCode?: string) => {
    const res = await api.register({
      name,
      email,
      password,
      ...(referralCode && referralCode.trim() ? { referralCode: referralCode.trim() } : {})
    });
    if (res.token && res.user) {
      localStorage.setItem('veloop_token', res.token);
      setToken(res.token);
      setUser(res.user);
      await refreshWallet();
    }
  };

  const logout = () => {
    localStorage.removeItem('veloop_token');
    setToken(null);
    setUser(null);
    setWallet(null);
  };

  const claimDailyReward = async () => {
    const res = await api.claimDaily();
    if (res.success && res.wallet) {
      setWallet(res.wallet);
    }
    return { success: res.success, message: res.message };
  };

  const quickLogin = async (type: 'user' | 'admin') => {
    if (type === 'admin') {
      await login('admin@veloop.test', 'AdminSecure123!');
    } else {
      await login('demo@veloop.test', 'Password123!');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        token,
        isLoading,
        dbStatus,
        isWheelModalOpen,
        setIsWheelModalOpen,
        login,
        register,
        logout,
        refreshWallet,
        refreshDbStatus: fetchHealthAndDb,
        claimDailyReward,
        quickLogin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
