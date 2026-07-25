const INTERNAL_LOGIN_DOMAIN = 'users.abdo-erp.app';

/**
 * Firebase email/password authentication requires an email address. This helper
 * lets the UI accept either a real email or a simple username while producing
 * the same deterministic internal email during account creation and login.
 */
export function normalizeLoginIdentifier(identifier: string): string {
  const normalized = identifier.trim().toLowerCase();

  if (normalized.includes('@')) {
    return normalized;
  }

  if (/^[a-z0-9._-]+$/.test(normalized)) {
    return `${normalized}@${INTERNAL_LOGIN_DOMAIN}`;
  }

  // FNV-1a keeps Arabic and other Unicode usernames deterministic and email-safe.
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(normalized)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  return `user-${(hash >>> 0).toString(16).padStart(8, '0')}@${INTERNAL_LOGIN_DOMAIN}`;
}
