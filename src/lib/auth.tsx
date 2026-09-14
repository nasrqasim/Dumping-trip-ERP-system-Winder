'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getRecordById, putRecord, deleteRecord, getAllRecords, DBUser } from '../db/firestore';

export type UserRole = 'superadmin' | 'manager' | 'operator';

export interface AppUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  getUsers: () => Promise<AppUser[]>;
  createUser: (userData: { username: string; name: string; role: UserRole; password: string; active?: boolean }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (username: string, updates: Partial<{ name: string; role: UserRole; password?: string; active: boolean }>) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (username: string) => Promise<{ success: boolean; error?: string }>;
  canAccess: (allowedRoles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'almadina_erp_auth_session';

// Secure Hashing Helpers using Web Crypto API
export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + ':' + salt);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  const str = password + ':' + salt;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and check for existing session & bootstrap default superadmin
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        // 1. Ensure superadmin exists in Firestore
        const adminUser = await getRecordById<DBUser>('users', 'superadmin');
        if (!adminUser) {
          const salt = generateSalt();
          const passwordHash = await hashPassword('hafeez123', salt);
          const initialSuperAdmin: DBUser = {
            id: 'superadmin',
            username: 'superadmin',
            name: 'Super Administrator',
            role: 'superadmin',
            passwordHash,
            salt,
            active: true,
            createdAt: new Date().toISOString(),
          };
          await putRecord('users', initialSuperAdmin);
        }

        // 2. Restore active session from localStorage if present
        const savedSession = localStorage.getItem(AUTH_STORAGE_KEY);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed && parsed.username) {
              const freshUser = await getRecordById<DBUser>('users', parsed.username.toLowerCase());
              if (freshUser && freshUser.active && isMounted) {
                setUser(freshUser as AppUser);
              } else if (isMounted) {
                localStorage.removeItem(AUTH_STORAGE_KEY);
                setUser(null);
              }
            }
          } catch (e) {
            localStorage.removeItem(AUTH_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    try {
      const userDoc = await getRecordById<DBUser>('users', cleanUsername);
      if (!userDoc) {
        return { success: false, error: 'Invalid username or password.' };
      }

      if (!userDoc.active) {
        return { success: false, error: 'Account is deactivated. Please contact an administrator.' };
      }

      const inputHash = await hashPassword(password, userDoc.salt);
      if (inputHash !== userDoc.passwordHash) {
        return { success: false, error: 'Invalid username or password.' };
      }

      const updatedUser: DBUser = {
        ...userDoc,
        lastLogin: new Date().toISOString(),
      };
      await putRecord('users', updatedUser);

      const appUser = updatedUser as AppUser;
      setUser(appUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        id: appUser.id,
        username: appUser.username,
        name: appUser.name,
        role: appUser.role,
        loggedInAt: new Date().toISOString(),
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed due to a server or network error.' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Not authenticated.' };
    }
    if (!newPassword || newPassword.length < 4) {
      return { success: false, error: 'New password must be at least 4 characters long.' };
    }

    try {
      const userDoc = await getRecordById<DBUser>('users', user.username.toLowerCase());
      if (!userDoc) {
        return { success: false, error: 'User not found.' };
      }

      const currentHash = await hashPassword(currentPassword, userDoc.salt);
      if (currentHash !== userDoc.passwordHash) {
        return { success: false, error: 'Current password does not match.' };
      }

      const newSalt = generateSalt();
      const newHash = await hashPassword(newPassword, newSalt);

      const updatedUser: DBUser = {
        ...userDoc,
        salt: newSalt,
        passwordHash: newHash,
      };

      await putRecord('users', updatedUser);
      setUser(updatedUser as AppUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update password.' };
    }
  }, [user]);

  const getUsers = useCallback(async (): Promise<AppUser[]> => {
    try {
      const allUsers = await getAllRecords<DBUser>('users', true);
      return allUsers as AppUser[];
    } catch (err) {
      console.error('Error fetching users:', err);
      return [];
    }
  }, []);

  const createUser = useCallback(async (userData: {
    username: string;
    name: string;
    role: UserRole;
    password: string;
    active?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = userData.username.trim().toLowerCase();
    if (!cleanUsername) return { success: false, error: 'Username is required.' };
    if (!userData.password || userData.password.length < 4) return { success: false, error: 'Password must be at least 4 characters.' };

    try {
      const existing = await getRecordById<DBUser>('users', cleanUsername);
      if (existing) {
        return { success: false, error: 'A user with this username already exists.' };
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(userData.password, salt);

      const newUser: DBUser = {
        id: cleanUsername,
        username: cleanUsername,
        name: userData.name.trim() || cleanUsername,
        role: userData.role,
        passwordHash,
        salt,
        active: userData.active !== undefined ? userData.active : true,
        createdAt: new Date().toISOString(),
      };

      await putRecord('users', newUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create user.' };
    }
  }, []);

  const updateUser = useCallback(async (
    username: string,
    updates: Partial<{ name: string; role: UserRole; password?: string; active: boolean }>
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = username.trim().toLowerCase();
    try {
      const existing = await getRecordById<DBUser>('users', cleanUsername);
      if (!existing) {
        return { success: false, error: 'User not found.' };
      }

      const updatedUser: DBUser = { ...existing };
      if (updates.name !== undefined) updatedUser.name = updates.name;
      if (updates.role !== undefined) updatedUser.role = updates.role;
      if (updates.active !== undefined) updatedUser.active = updates.active;

      if (updates.password && updates.password.length >= 4) {
        const newSalt = generateSalt();
        updatedUser.salt = newSalt;
        updatedUser.passwordHash = await hashPassword(updates.password, newSalt);
      }

      await putRecord('users', updatedUser);

      if (user && user.username.toLowerCase() === cleanUsername) {
        setUser(updatedUser as AppUser);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update user.' };
    }
  }, [user]);

  const deleteUser = useCallback(async (username: string): Promise<{ success: boolean; error?: string }> => {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername === 'superadmin') {
      return { success: false, error: 'The primary superadmin account cannot be deleted.' };
    }
    if (user && user.username.toLowerCase() === cleanUsername) {
      return { success: false, error: 'You cannot delete your own logged-in account.' };
    }

    try {
      await deleteRecord('users', cleanUsername);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete user.' };
    }
  }, [user]);

  const canAccess = useCallback((allowedRoles: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(user.role);
    }
    return user.role === allowedRoles;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        changePassword,
        getUsers,
        createUser,
        updateUser,
        deleteUser,
        canAccess,
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
