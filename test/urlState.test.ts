import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE, parseUrlState, serializeUrlState } from '../src/lib/urlState';

describe('URL state', () => {
  it('defaults to an empty query string', () => {
    expect(serializeUrlState(DEFAULT_STATE)).toBe('');
    expect(parseUrlState('')).toEqual(DEFAULT_STATE);
  });

  it('round-trips a full setup, mapping included', () => {
    const state = { sample: 'wrong-headers', schema: 'contacts', locale: 'eu' as const, validate: false, worker: false, code: 'hook' as const, mapping: { email: 'Kontakt', joined: null, amount: 'Bétrag' } };
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
  });

  it('a sample brings its schema and locale unless the URL overrides them', () => {
    expect(parseUrlState('?sample=missing-required')).toMatchObject({ schema: 'products', locale: 'auto' });
    expect(parseUrlState('?sample=wrong-headers')).toMatchObject({ schema: 'contacts', locale: 'eu' });
    expect(parseUrlState('?sample=wrong-headers&locale=us&schema=orders')).toMatchObject({ schema: 'orders', locale: 'us' });
  });

  it('ignores unknown and malformed values', () => {
    expect(parseUrlState('?sample=nope&schema=nope&locale=xx&code=yy&map=%%%')).toEqual(DEFAULT_STATE);
    const proto = btoa('{"__proto__":"x","a":1,"b":"B"}');
    expect(parseUrlState(`?map=${proto}`).mapping).toEqual({ b: 'B' });
  });
});
