import { describe, expect, it } from 'vitest';
import {
  decimalText,
  displayMoney,
  JsonNumber,
  parseExactJson,
  stringifyExactJson,
  validMoney,
  validWeight,
} from './exact-json';

describe('exact numeric transport', () => {
  it('retains large monetary tokens without a Number round trip', () => {
    const source =
      '{"total":90071992547409.93,"weight":2.5000833333333333333333333333}';
    expect(stringifyExactJson(parseExactJson(source))).toBe(source);
    expect(displayMoney('90071992547409.93', 'LKR')).toBe(
      'LKR 90,071,992,547,409.93',
    );
  });

  it('preserves strings, escaped quotes, nulls and arrays', () => {
    const source =
      '{"text":"A \\"quoted\\" street","values":[true,false,null,-1.25e2]}';
    expect(stringifyExactJson(parseExactJson(source))).toBe(source);
  });

  it.each([
    '{"a":1,"a":2}',
    '{"a":01}',
    '[1,]',
    '{"a":}',
    'true false',
    '"unterminated',
    '{"a":"bad\ntext"}',
  ])('rejects invalid or ambiguous JSON: %s', (source) => {
    expect(() => parseExactJson(source)).toThrow();
  });

  it.each([
    '0',
    '540.00',
    '90071992547409.93',
    '9999999999999999.99',
    '5.40e2',
  ])('accepts supported exact money: %s', (source) => {
    expect(validMoney(source)).toBe(true);
    expect(stringifyExactJson(new JsonNumber(source))).toBe(source);
  });

  it.each([
    '01',
    '+1',
    '.1',
    '1.',
    'NaN',
    'Infinity',
    '-1',
    '10000000000000000',
    '1.001',
    '1e9999',
  ])('rejects invalid money: %s', (source) => {
    expect(validMoney(source)).toBe(false);
  });

  it.each([
    '0.0000000000000000000000000001',
    '2.5000833333333333333333333333',
    '30',
    '30.000',
  ])('accepts exact supported weight: %s', (source) => {
    expect(validWeight(source)).toBe(true);
  });

  it.each([
    '0',
    '-1',
    '30.0001',
    '1e1',
    '01',
    '0.00000000000000000000000000001',
    '7.9228162514264337593543950336',
  ])('rejects weight outside the exact decimal range: %s', (source) => {
    expect(validWeight(source)).toBe(false);
  });

  it('normalizes decimal values without rounding', () => {
    expect(decimalText('5.400e2')).toBe('540');
    expect(decimalText('1.25e-2')).toBe('0.0125');
  });
});
