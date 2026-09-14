'use client';

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Key, 
  UserPlus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  LogOut, 
  Loader2, 
  Info,
  Edit2,
  Lock
} from 'lucide-react';
import { useAuth, AppUser, UserRole } from '../lib/auth';

interface SettingsProps {
  onLogoutSuccess?: () => void;
}

export default function Settings({ onLogoutSuccess }: SettingsProps) {
  const { user, changePassword, getUsers, createUser, updateUser, deleteUser, logout } = useAuth();

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);

  // User Management state (superadmin only)
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);

  // New/Edit User Form
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('operator');
  const [formPassword, setFormPassword] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  const fetchUsers = async () => {
    if (user?.role === 'superadmin') {
      setIsLoadingUsers(true);
      try {
        const list = await getUsers();
        setUsersList(list);
      } catch (err) {
        console.error('Failed to load users', err);
      } finally {
        setIsLoadingUsers(false);
      }
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwSuccess('');
    setPwError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('Please fill out all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 4) {
      setPwError('Password must be at least 4 characters.');
      return;
    }

    setIsUpdatingPw(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setPwSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPwError(res.error || 'Failed to update password.');
      }
    } catch (err: any) {
      setPwError(err.message || 'Error updating password.');
    } finally {
      setIsUpdatingPw(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingUsername(null);
    setFormUsername('');
    setFormName('');
    setFormRole('operator');
    setFormPassword('');
    setFormActive(true);
    setFormError('');
    setUserModalOpen(true);
  };

  const handleOpenEditModal = (u: AppUser) => {
    setEditingUsername(u.username);
    setFormUsername(u.username);
    setFormName(u.name);
    setFormRole(u.role);
    setFormPassword('');
    setFormActive(u.active);
    setFormError('');
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!editingUsername && !formUsername.trim()) {
      setFormError('Username is required.');
      return;
    }

    if (!editingUsername && (!formPassword || formPassword.length < 4)) {
      setFormError('Password must be at least 4 characters.');
      return;
    }

    setIsSavingUser(true);
    try {
      if (editingUsername) {
        // Edit existing
        const updates: any = {
          name: formName.trim() || formUsername,
          role: formRole,
          active: formActive,
        };
        if (formPassword.trim()) {
          if (formPassword.length < 4) {
            setFormError('Password must be at least 4 characters.');
            setIsSavingUser(false);
            return;
          }
          updates.password = formPassword;
        }

        const res = await updateUser(editingUsername, updates);
        if (res.success) {
          setUserModalOpen(false);
          await fetchUsers();
        } else {
          setFormError(res.error || 'Failed to update user.');
        }
      } else {
        // Create new
        const res = await createUser({
          username: formUsername,
          name: formName,
          role: formRole,
          password: formPassword,
          active: formActive,
        });

        if (res.success) {
          setUserModalOpen(false);
          await fetchUsers();
        } else {
          setFormError(res.error || 'Failed to create user.');
        }
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (confirm(`Are you sure you want to permanently delete user "${username}"?`)) {
      try {
        const res = await deleteUser(username);
        if (res.success) {
          await fetchUsers();
        } else {
          alert(res.error || 'Failed to delete user.');
        }
      } catch (err: any) {
        alert(err.message || 'Error deleting user.');
      }
    }
  };

  const handleLogout = () => {
    logout();
    if (onLogoutSuccess) {
      onLogoutSuccess();
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">Account &amp; System Settings</h1>
            <p className="text-xs text-slate-500 font-medium">Manage your security credentials, role access, and staff accounts</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition shrink-0"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out of ERP</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3">
            <Shield className="h-4 w-4 text-indigo-600" />
            <span>Active Session Profile</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Full Name</span>
              <span className="font-bold text-slate-800 text-sm">{user?.name || 'Administrator'}</span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Username</span>
              <span className="font-mono text-slate-700 font-semibold">{user?.username}</span>
            </div>

            <div>
              <span className="text-slate-400 block font-medium">Assigned Role</span>
              <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase text-[10px] tracking-wider mt-1 ${
                user?.role === 'superadmin' 
                  ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                  : user?.role === 'manager'
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}>
                {user?.role}
              </span>
            </div>

            {user?.lastLogin && (
              <div>
                <span className="text-slate-400 block font-medium">Last Login</span>
                <span className="text-slate-600">{new Date(user.lastLogin).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Form */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm border-b border-slate-100 pb-3 mb-4">
            <Key className="h-4 w-4 text-indigo-600" />
            <span>Change Your Password</span>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            {pwSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs text-emerald-700">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{pwError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingPw}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center space-x-2 disabled:opacity-50 transition"
            >
              {isUpdatingPw ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  <span>Save New Password</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Superadmin User Management Section */}
      {user?.role === 'superadmin' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-purple-600" />
                <h2 className="text-base font-bold text-slate-800">ERP User Accounts &amp; Permissions</h2>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Create and manage staff login accounts (Superadmin, Manager, Operator)
              </p>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow-sm shadow-indigo-600/20 transition self-start sm:self-auto"
            >
              <UserPlus className="h-4 w-4" />
              <span>Add New User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            {isLoadingUsers ? (
              <div className="p-10 text-center text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                <span>Loading users...</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u.id || u.username} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {u.username}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {u.name}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'superadmin'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'manager'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 transition"
                          title="Edit User"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {u.username !== 'superadmin' && u.username !== user.username && (
                          <button
                            onClick={() => handleDeleteUser(u.username)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {usersList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* User Create/Edit Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm">
                {editingUsername ? `Edit User: ${editingUsername}` : 'Create New User'}
              </h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username ID
                </label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  disabled={!!editingUsername}
                  placeholder="e.g. manager1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Muhammad Ali"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="operator">Operator (Standard Entry &amp; Weighing)</option>
                  <option value="manager">Manager (Operations, CRM, Reports)</option>
                  <option value="superadmin">Superadmin (Full System Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {editingUsername ? 'Reset Password (Leave blank to keep unchanged)' : 'Initial Password'}
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUsername ? '••••••••' : 'Min 4 characters'}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="activeToggle"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded border-slate-300"
                />
                <label htmlFor="activeToggle" className="text-xs font-semibold text-slate-700">
                  Account is Active (Can sign in)
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSavingUser && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingUsername ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* System Information Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Info className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-800">Al-Madina Construction Company ERP v2.0</p>
            <p className="text-[11px]">80mm High-Contrast Thermal Printing • Realtime Ledger Engine</p>
          </div>
        </div>
        <div className="text-center sm:text-right">
          <p className="font-semibold text-slate-700">Developed by Roonjha Developers</p>
          <p className="text-indigo-600 font-bold">Contact: 03152914836</p>
        </div>
      </div>
    </div>
  );
}
