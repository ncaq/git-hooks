import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";

/** 句点として見做す文字の集合。 */
const periodChars = ".。．" as const;

/**
 * 句点ではない文字を1文字以上連続で消費し、消費した文字列を返す。
 * 読点を含む句点以外の文字を全て消費するので、句点判定では読点は無害扱いになる。
 * 1ステップで可能な限り長くマッチさせるため、1文字単位ではなく文字列単位の処理になる。
 */
const safeRun: P.Parser<C.Char, string> = C.many1(C.notOneOf(periodChars));

/**
 * 「中間句点なし」の行を読み切るパーサ。
 * 句点以外を0回以上消費した後、最終1文字を任意に消費して終わる(空行も許容)。
 * 句点に閾値許容は無いため、中間に句点が現れた時点で失敗する。
 */
const noMidLinePeriod: P.Parser<C.Char, void> = pipe(
  P.many(safeRun),
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

/** 行に中間句点が無いかを判定する。 */
export function hasNoMidLinePeriod(line: string): boolean {
  return isRight(noMidLinePeriod(stream(Array.from(line))));
}
