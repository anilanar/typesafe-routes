export type Parser<T> = {
  _A: T;
  encode: Encode<T>;
  decode: Decode<T>;
};

export type Option<T> =
  | { readonly tag: "some"; readonly value: T }
  | { readonly tag: "none" };

export type Encode<T> = (input: T) => Option<string>;
export type Decode<T> = (input: string) => Option<T>;

const some = <T>(value: T) => ({ tag: "some", value } as const);
const none = { tag: "none" } as const;

const mkParser = <T>(decode: Decode<T>, encode: Encode<T>): Parser<T> =>
  ({
    encode,
    decode,
  } as Parser<T>);

export const stringParser = mkParser<string>((value) => some(value), some);

export const floatParser = mkParser<number>(
  (s) => {
    const f = parseFloat(s);
    return isNaN(f) ? none : some(f);
  },
  (x) => (isNaN(x) ? none : some(x.toString()))
);

export const intParser = mkParser<number>(
  (s) => {
    const i = parseInt(s);
    return isNaN(i) ? none : some(i);
  },
  (x) => (isNaN(x) ? none : some(x.toString()))
);

export const dateParser = mkParser<Date>(
  (s) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? none : some(d);
  },
  (d) => (isNaN(d.getTime()) ? none : some(d.toISOString()))
);

export const booleanParser = mkParser<boolean>(
  (s) => some(s === "true"),
  (b) => (b ? some("true") : none)
);

export const optional = <T>(parser: Parser<T>): Parser<T | undefined> => {
  return mkParser<T | undefined>(parser.decode, (value) =>
    value === undefined ? none : parser.encode(value)
  );
};
