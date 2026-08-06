import type { Member, MemberRole } from '../types';

/**
 * Default Seed Members used to initialize a new workspace.
 * Note: The runtime member registry supports unlimited members.
 */
export const DEFAULT_MEMBERS: Member[] = [
  {
    id: 'MEM-101',
    name: 'Venky',
    email: 'venkateshvelamuri5@gmail.com',
    role: 'PRODUCT_MANAGER',
    avatarColor: '#3b82f6',
  },
  {
    id: 'MEM-102',
    name: 'Togy',
    email: 'togyjose@logmark-ai.com',
    role: 'PRODUCT_MANAGER',
    avatarColor: '#8b5cf6',
  },
  {
    id: 'MEM-103',
    name: 'Mohan',
    email: 'mohan@orglens.com',
    role: 'PRODUCT_MANAGER',
    avatarColor: '#10b981',
  },
  {
    id: 'MEM-104',
    name: 'Deepika',
    email: 'deepika.nuti@logmark-ai.com',
    role: 'INTERN',
    avatarColor: '#ec4899',
  },
  {
    id: 'MEM-105',
    name: 'Manasa',
    email: 'manasa@logmark-ai.com',
    role: 'INTERN',
    avatarColor: '#f59e0b',
  },
  {
    id: 'MEM-106',
    name: 'Oliver',
    email: 'oliver.jude@logmark-ai.com',
    role: 'INTERN',
    avatarColor: '#06b6d4',
  },
];

/**
 * Known organization roles mapped by email address.
 */
export const ORG_MEMBER_EMAIL_ROLES: Record<string, MemberRole> = {
  'venkateshvelamuri5@gmail.com': 'PRODUCT_MANAGER',
  'togyjose@logmark-ai.com': 'PRODUCT_MANAGER',
  'mohan@orglens.com': 'PRODUCT_MANAGER',
  'deepika.nuti@logmark-ai.com': 'INTERN',
  'manasa@logmark-ai.com': 'INTERN',
  'oliver.jude@logmark-ai.com': 'INTERN',
};

/**
 * Known alias mappings for deduplication & legacy normalization.
 */
const MEMBER_ALIASES: Record<string, string> = {
  'deepika@gmail.com': 'deepika.nuti@logmark-ai.com',
  'deepikanuti@gmail.com': 'deepika.nuti@logmark-ai.com',
  'mansa@logmark-ai.com': 'manasa@logmark-ai.com',
};

/**
 * Lookup member by exact email or alias.
 */
export function lookupMemberByEmail(email: string, members: Member[]): Member | undefined {
  if (!email) return undefined;
  const cleanEmail = (MEMBER_ALIASES[email.toLowerCase().trim()] || email.toLowerCase().trim());
  return members.find(m => m.email.toLowerCase() === cleanEmail);
}

/**
 * Lookup member by name.
 */
export function lookupMemberByName(name: string, members: Member[]): Member | undefined {
  if (!name) return undefined;
  const cleanName = name.trim().toLowerCase();
  return members.find(m => m.name.toLowerCase() === cleanName);
}

/**
 * Resolve canonical member name from any string reference (name or email or alias).
 */
export function normalizeMemberReference(ref: string, members: Member[] = DEFAULT_MEMBERS): string {
  if (!ref) return '';
  const clean = ref.trim().toLowerCase();
  
  // Try email lookup
  const byEmail = lookupMemberByEmail(clean, members);
  if (byEmail) return byEmail.name;

  // Try name lookup
  const byName = lookupMemberByName(clean, members);
  if (byName) return byName.name;

  // Check aliases
  if (clean.includes('deepika')) return 'Deepika';
  if (clean.includes('manasa') || clean.includes('mansa')) return 'Manasa';
  if (clean.includes('oliver')) return 'Oliver';
  if (clean.includes('venky') || clean.includes('venkatesh')) return 'Venky';
  if (clean.includes('togy')) return 'Togy';
  if (clean.includes('mohan')) return 'Mohan';

  return ref;
}

/**
 * Deduplicate and normalize a member list.
 * Prefers official `@logmark-ai.com` email addresses and canonical names.
 */
export function sanitizeAndDeduplicateMembers(inputMembers: Member[]): Member[] {
  const map = new Map<string, Member>();

  // Initialize with seed members
  DEFAULT_MEMBERS.forEach(m => {
    map.set(m.email.toLowerCase(), { ...m });
  });

  inputMembers.forEach(raw => {
    if (!raw.name && !raw.email) return;

    let email = (raw.email || '').toLowerCase().trim();
    let name = (raw.name || '').trim();

    // Alias mapping check
    if (MEMBER_ALIASES[email]) {
      email = MEMBER_ALIASES[email];
    }

    // Check if matching seed or existing entry exists by email or name
    let existingKey: string | undefined;
    for (const [key, existing] of map.entries()) {
      if (
        (email && key === email) ||
        (name && existing.name.toLowerCase() === name.toLowerCase())
      ) {
        existingKey = key;
        break;
      }
    }

    if (existingKey) {
      const existing = map.get(existingKey)!;
      // Prefer @logmark-ai.com email
      const preferLogmark = email.endsWith('@logmark-ai.com') && !existing.email.endsWith('@logmark-ai.com');
      const updated: Member = {
        ...existing,
        id: existing.id || raw.id,
        email: preferLogmark ? email : existing.email,
        name: existing.name || name,
        role: existing.role || raw.role || 'EMPLOYEE',
        avatarColor: existing.avatarColor || raw.avatarColor || '#3b82f6',
      };
      if (preferLogmark) {
        map.delete(existingKey);
        map.set(email, updated);
      } else {
        map.set(existingKey, updated);
      }
    } else {
      // New dynamic member
      const newEmail = email || `${name.toLowerCase().replace(/\s+/g, '.')}@logmark-ai.com`;
      map.set(newEmail, {
        id: raw.id || `MEM-${Math.floor(1000 + Math.random() * 9000)}`,
        name: name || newEmail.split('@')[0],
        email: newEmail,
        role: raw.role || ORG_MEMBER_EMAIL_ROLES[newEmail] || 'EMPLOYEE',
        avatarColor: raw.avatarColor || '#3b82f6',
      });
    }
  });

  return Array.from(map.values());
}
