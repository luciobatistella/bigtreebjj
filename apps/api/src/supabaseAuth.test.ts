import { describe, expect, it } from 'vitest';
import { isAdminUser } from './supabaseAuth.js';

describe('Supabase admin authorization', () => {
  it('accepts a user with the admin app_metadata role', () => {
    expect(
      isAdminUser(
        { id: 'user-1', email: 'editor@example.com', app_metadata: { role: 'admin' } },
        new Set()
      )
    ).toBe(true);
  });

  it('accepts an explicitly allowed email case-insensitively', () => {
    expect(
      isAdminUser(
        { id: 'user-2', email: 'CURATOR@example.com', app_metadata: {} },
        new Set(['curator@example.com'])
      )
    ).toBe(true);
  });

  it('rejects a regular authenticated user', () => {
    expect(
      isAdminUser(
        { id: 'user-3', email: 'visitor@example.com', app_metadata: { role: 'authenticated' } },
        new Set(['curator@example.com'])
      )
    ).toBe(false);
  });
});
