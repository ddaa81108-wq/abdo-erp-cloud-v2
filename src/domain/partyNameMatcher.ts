import type { ERPState } from '../types';

export type PartyMatch = {
  id: string;
  name: string;
  aliases: string[];
  source: 'customer' | 'business' | 'deposit';
  status: 'active' | 'archived';
  score: number;
  phone?: string;
};

export function normalizeArabicName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function bigrams(value: string) {
  const compact = value.replace(/\s/g, '');
  const values = new Set<string>();
  for (let index = 0; index < compact.length - 1; index += 1) {
    values.add(compact.slice(index, index + 2));
  }
  return values;
}

export function nameSimilarity(query: string, candidate: string) {
  const left = normalizeArabicName(query);
  const right = normalizeArabicName(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.92;
  const leftWords = new Set(left.split(' '));
  const rightWords = new Set(right.split(' '));
  const sharedWords = [...leftWords].filter((word) => rightWords.has(word)).length;
  const wordScore = sharedWords / Math.max(1, Math.min(leftWords.size, rightWords.size));
  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  const sharedPairs = [...leftPairs].filter((pair) => rightPairs.has(pair)).length;
  const pairScore = (2 * sharedPairs) / Math.max(1, leftPairs.size + rightPairs.size);
  return Math.max(wordScore, pairScore);
}

export function findSimilarParties(
  state: ERPState,
  query: string,
  minimumScore = 0.42,
): PartyMatch[] {
  if (normalizeArabicName(query).length < 2) return [];
  const candidates: Omit<PartyMatch, 'score'>[] = [
    ...(state.customers || []).map((customer) => ({
      id: customer.id,
      name: customer.name,
      aliases: customer.nameAliases || [],
      source: 'customer' as const,
      status: customer.isDeleted ? 'archived' as const : 'active' as const,
      phone: customer.phone,
    })),
    ...(state.companies || []).map((account) => ({
      id: account.id,
      name: account.name,
      aliases: account.nameAliases || [],
      source: 'business' as const,
      status: account.isDeleted ? 'archived' as const : 'active' as const,
      phone: account.contact,
    })),
    ...(state.trustDeposits || []).map((deposit) => ({
      id: deposit.id,
      name: deposit.customerName,
      aliases: [] as string[],
      source: 'deposit' as const,
      status: deposit.isDeleted ? 'archived' as const : 'active' as const,
    })),
  ];
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: Math.max(
        nameSimilarity(query, candidate.name),
        ...candidate.aliases.map((alias) => nameSimilarity(query, alias)),
      ),
    }))
    .filter((candidate) => candidate.score >= minimumScore)
    .sort((a, b) => b.score - a.score || Number(a.status === 'archived') - Number(b.status === 'archived'))
    .slice(0, 20);
}
