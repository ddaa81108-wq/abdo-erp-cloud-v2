import { describe, expect, it } from 'vitest';
import type { User } from '../types';
import { canAccessTab, DENIED_PERMISSIONS, FULL_PERMISSIONS } from './permissions';

const user = (role: User['role'], canViewBackup: boolean): User => ({
  id: role,
  username: role,
  name: role,
  role,
  password: '',
  permissions: role === 'admin'
    ? FULL_PERMISSIONS
    : { ...DENIED_PERMISSIONS, canViewBackup },
  createdAt: '2026-08-03',
});

describe('administrative tab protection', () => {
  it('allows only administrators to open backup and settings sections', () => {
    expect(canAccessTab(user('admin', true), 'backup')).toBe(true);
    expect(canAccessTab(user('admin', true), 'settings')).toBe(true);
    expect(canAccessTab(user('assistant', true), 'backup')).toBe(false);
    expect(canAccessTab(user('assistant', true), 'settings')).toBe(false);
  });
});
