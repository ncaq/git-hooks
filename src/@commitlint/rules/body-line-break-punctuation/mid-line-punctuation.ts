import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream, type Stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
const commaPrefixThreshold = 6 as const;

/** 読点として見做す文字の集合。 */
const commaChars = ",，、" as const;

/** 句点として見做す文字の集合。 */
const periodChars = ".。．" as const;

/** 句読点として見做す文字の集合。 */
const punctuationChars: string = commaChars + periodChars;

/**
 * 句読点ではない文字を1文字以上連続で消費し、消費した文字列を返す。
 * 1ステップで可能な限り長くマッチさせるため、1文字単位ではなく文字列単位の処理になる。
 */
const safeRun: P.Parser<C.Char, string> = C.many1(C.notOneOf(punctuationChars));

/**
 * 短い前置きの後の読点(1文字)を消費する。
 * 開始位置が`commaPrefixThreshold`未満のときのみ成功する。
 */
const earlyComma: P.Parser<C.Char, string> = pipe(
  P.withStart(C.oneOf(commaChars)),
  P.filter(([, start]: [string, Stream<C.Char>]) => start.cursor < commaPrefixThreshold),
  P.map(([s]) => s),
);

/**
 * 中間として消費可能な1ステップ。
 * 必ず1文字以上消費するので、`many`しても無限ループにならない。
 */
const midStep: P.Parser<C.Char, string> = P.either(safeRun, () => earlyComma);

/**
 * 「中間句読点なし」の行を読み切るパーサ。
 * 中間ステップを0回以上消費した後、最終1文字を任意に消費して終わる(空行も許容)。
 */
const noMidLinePunctuation: P.Parser<C.Char, void> = pipe(
  P.many(midStep),
  P.chain(() =>
    P.either(
      pipe(
        P.eof<C.Char>(),
        P.map<void, void>(() => undefined),
      ),
      () =>
        pipe(
          P.item<C.Char>(),
          P.chainFirst(() => P.eof<C.Char>()),
          P.map<C.Char, void>(() => undefined),
        ),
    ),
  ),
);

/** 行に中間句読点が無いかを判定する。 */
export function hasNoMidLinePunctuation(line: string): boolean {
  return isRight(noMidLinePunctuation(stream(Array.from(line))));
}
