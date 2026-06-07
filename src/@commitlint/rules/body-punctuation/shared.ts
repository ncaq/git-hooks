/** 読点として見做す文字の集合。 */
export const commaChars = ",，、" as const;

/** 句点として見做す文字の集合。 */
export const periodChars = ".。．" as const;

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
export const commaPrefixThreshold = 6 as const;

/**
 * 行末として許容する終端正規表現。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
export const defaultTerminator = /(?:[\p{P}`])$/u;

export { extractLines } from "./extract-markdown";
