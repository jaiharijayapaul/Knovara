import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, LoginPayload, RegisterPayload } from '@/types/auth';
import { loginUser, registerUser, fetchCurrentUser, loginWithGoogle } from '@/services/api';
import type { GoogleAuthPayload } from '@/services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginPayload) => Promise<void>;
  loginGoogle: (payload: GoogleAuthPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('knovara_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('knovara_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate active session token against backend on mount
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('knovara_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
        localStorage.setItem('knovara_user', JSON.stringify(currentUser));
      } catch (error) {
        console.warn('Session expired or invalid token:', error);
        localStorage.removeItem('knovara_token');
        localStorage.removeItem('knovara_user');
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = useCallback(async (credentials: LoginPayload) => {
    setIsLoading(true);
    try {
      const response = await loginUser(credentials);
      localStorage.setItem('knovara_token', response.access_token);
      localStorage.setItem('knovara_user', JSON.stringify(response.user));
      setToken(response.access_token);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterPayload) => {
    setIsLoading(true);
    try {
      const response = await registerUser(data);
      localStorage.setItem('knovara_token', response.access_token);
      localStorage.setItem('knovara_user', JSON.stringify(response.user));
      setToken(response.access_token);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loginGoogle = useCallback(async (data: GoogleAuthPayload) => {
    setIsLoading(true);
    try {
      const response = await loginWithGoogle(data);
      localStorage.setItem('knovara_token', response.access_token);
      localStorage.setItem('knovara_user', JSON.stringify(response.user));
      setToken(response.access_token);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('knovara_token');
    localStorage.removeItem('knovara_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        loginGoogle,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
