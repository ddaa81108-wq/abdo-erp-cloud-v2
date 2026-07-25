import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE } from '../types';
import { findSimilarParties, nameSimilarity, normalizeArabicName } from './partyNameMatcher';

describe('party name matching', () => {
  it('normalizes common Arabic spelling differences', () => {
    expect(normalizeArabicName('أحمد  إبراهيم')).toBe('احمد ابراهيم');
    expect(nameSimilarity('ورشة أحمد', 'احمد ورشه ابراهيم')).toBeGreaterThan(0.4);
  });

  it('finds active, archived, and aliased names across financial sections', () => {
    const state = structuredClone(INITIAL_ERP_STATE);
    state.customers = [{
      id: 'old',
      name: 'ورشة إبراهيم',
      nameAliases: ['أحمد ورشة إبراهيم'],
      createdAt: '2025-01-01',
      isDeleted: true,
    }];
    state.companies = [{
      id: 'business',
      name: 'شركة أحمد للتجارة',
      accountType: 'company',
      balance: 0,
    }];
    state.trustDeposits = [];
    const matches = findSimilarParties(state, 'احمد ورشه');
    expect(matches.map((match) => match.id)).toContain('old');
    expect(matches.map((match) => match.id)).toContain('business');
    expect(matches.find((match) => match.id === 'old')?.status).toBe('archived');
  });
});
