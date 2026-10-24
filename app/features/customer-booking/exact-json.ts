/** Numeric JSON tokens are retained before a binary floating-point conversion. */
export class JsonNumber {
  constructor(readonly source: string) {
    if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(source)) {
      throw new Error('Invalid JSON number.');
    }
  }
}

export type JsonValue =
  | null
  | boolean
  | string
  | JsonNumber
  | JsonValue[]
  | { [key: string]: JsonValue };

export function parseExactJson(text: string): JsonValue {
  let offset = 0;
  const whitespace = () => {
    while (/[\t\n\r ]/.test(text[offset] ?? '\0')) offset++;
  };
  const string = (): string => {
    const start = offset++;
    while (offset < text.length) {
      const character = text[offset++];
      if (character === '\\') offset++;
      else if (character === '"') {
        const value: unknown = JSON.parse(text.slice(start, offset));
        if (typeof value !== 'string') throw new Error('Invalid string.');
        return value;
      }
    }
    throw new Error('Unterminated string.');
  };
  const value = (depth: number): JsonValue => {
    if (depth > 40) throw new Error('JSON nesting is too deep.');
    whitespace();
    if (text[offset] === '"') return string();
    if (text[offset] === '{') {
      offset++;
      const result: { [key: string]: JsonValue } = Object.create(null) as {
        [key: string]: JsonValue;
      };
      whitespace();
      if (text[offset] === '}') {
        offset++;
        return result;
      }
      for (;;) {
        whitespace();
        if (text[offset] !== '"') throw new Error('Expected JSON key.');
        const key = string();
        if (Object.hasOwn(result, key)) throw new Error('Duplicate JSON key.');
        whitespace();
        if (text[offset++] !== ':') throw new Error('Expected colon.');
        result[key] = value(depth + 1);
        whitespace();
        const delimiter = text[offset++];
        if (delimiter === '}') return result;
        if (delimiter !== ',') throw new Error('Expected object delimiter.');
      }
    }
    if (text[offset] === '[') {
      offset++;
      const result: JsonValue[] = [];
      whitespace();
      if (text[offset] === ']') {
        offset++;
        return result;
      }
      for (;;) {
        result.push(value(depth + 1));
        whitespace();
        const delimiter = text[offset++];
        if (delimiter === ']') return result;
        if (delimiter !== ',') throw new Error('Expected array delimiter.');
      }
    }
    for (const [token, parsed] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (text.startsWith(token, offset)) {
        offset += token.length;
        return parsed;
      }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      text.slice(offset),
    );
    if (!match) throw new Error('Expected JSON value.');
    offset += match[0].length;
    return new JsonNumber(match[0]);
  };
  const result = value(0);
  whitespace();
  if (offset !== text.length) throw new Error('Trailing JSON input.');
  return result;
}

export function stringifyExactJson(value: JsonValue): string {
  if (value instanceof JsonNumber) return value.source;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stringifyExactJson).join(',')}]`;
  }
  return `{${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}:${stringifyExactJson(item)}`)
    .join(',')}}`;
}

/** Convert a bounded JSON decimal to plain notation, retaining every digit. */
export function decimalText(source: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match || source.length > 100) throw new Error('Unsupported decimal.');
  const exponent = Number(match[4] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 50) {
    throw new Error('Unsupported decimal exponent.');
  }
  const whole = match[2]!;
  const fraction = match[3] ?? '';
  const digits = whole + fraction;
  const point = whole.length + exponent;
  const expanded =
    point <= 0
      ? `0.${'0'.repeat(-point)}${digits}`
      : point >= digits.length
        ? digits + '0'.repeat(point - digits.length)
        : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [integer, decimals = ''] = expanded.split('.');
  const normalizedWhole = integer!.replace(/^0+(?=\d)/, '');
  const normalizedFraction = decimals.replace(/0+$/, '');
  const unsigned = `${normalizedWhole}${normalizedFraction ? `.${normalizedFraction}` : ''}`;
  return match[1] && unsigned !== '0' ? `-${unsigned}` : unsigned;
}

export function validMoney(source: string): boolean {
  try {
    new JsonNumber(source);
    const plain = decimalText(source);
    const [whole, fraction = ''] = plain.split('.');
    return (
      !plain.startsWith('-') && whole!.length <= 16 && fraction.length <= 2
    );
  } catch {
    return false;
  }
}

export function validWeight(source: string): boolean {
  try {
    if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(source)) return false;
    const plain = decimalText(source);
    const [whole, fraction = ''] = plain.split('.');
    const coefficient = BigInt(`${whole}${fraction}`);
    return (
      coefficient > 0n &&
      coefficient <= 30n * 10n ** BigInt(fraction.length) &&
      fraction.length <= 28 &&
      coefficient <= 79228162514264337593543950335n
    );
  } catch {
    return false;
  }
}

export function displayMoney(source: string, currency: string): string {
  const [whole, fraction = ''] = decimalText(source).split('.');
  return `${currency} ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
}
