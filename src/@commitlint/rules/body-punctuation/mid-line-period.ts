import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";

/** 句点として見做す文字の集合。 */
const periodChars = ".。．" as const;

/**
 * 単語内ピリオドの許可対象となる文字(ASCII英数字)の判定。
 * `Node.js`のようなコードネームや`9.12`のようなバージョン番号・数値を構成する。
 * 日本語文の区切りに使われた半角ピリオドまで許可しないよう、ASCIIに限定する。
 */
function isWordChar(char: C.Char): boolean {
  return /^[0-9A-Za-z]$/.test(char);
}

/** ASCII英数字を1文字以上連続で消費し、消費した文字列を返す。 */
const wordRun: P.Parser<C.Char, string> = C.many1(
  P.expected(P.sat(isWordChar), "an ascii alphanumeric character"),
);

/**
 * 単語内ピリオドとその後続の英数字列を消費する。
 * ピリオドの直後に英数字が続かない場合は失敗し、
 * バックトラックによってピリオドは消費されなかったことになる。
 */
const wordDot: P.Parser<C.Char, string> = pipe(
  C.char("."),
  P.chain(() => wordRun),
);

/**
 * 英数字列を、英数字に挟まれた半角ピリオドで連結した「単語」を消費する。
 * `Node.js`、`GHC 9.12`の`9.12`、`1.5倍`の`1.5`などがこれに該当する。
 * 全角句点(`。`/`．`)は単語内であっても許可しない。
 */
const word: P.Parser<C.Char, string> = pipe(
  wordRun,
  P.chainFirst(() => P.many(wordDot)),
);

/**
 * 句点でも単語構成文字でもない文字を1文字以上連続で消費し、消費した文字列を返す。
 * 読点を含む句点以外の文字を全て消費するので、句点判定では読点は無害扱いになる。
 * 単語構成文字を除外するのは、単語の先頭を先に消費してしまうと
 * `word`パーサが単語内ピリオドを判定できなくなるためです。
 */
const plainRun: P.Parser<C.Char, string> = C.many1(
  P.expected(
    P.sat<C.Char>((char) => !periodChars.includes(char) && !isWordChar(char)),
    "a character that is neither a period nor a word character",
  ),
);

/**
 * 「中間句点なし」の行を読み切るパーサ。
 * 単語(単語内ピリオドを許容)とそれ以外の安全な文字列を0回以上消費した後、
 * 最終1文字を任意に消費して終わる(空行も許容)。
 * 単語内ピリオドを除き、中間に句点が現れた時点で失敗する。
 */
const noMidLinePeriod: P.Parser<C.Char, void> = pipe(
  P.many(P.either(word, () => plainRun)),
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

/** 行の途中に句点(単語内ピリオドを除く)が含まれるかを判定する。 */
export function hasMidLinePeriod(line: string): boolean {
  return !isRight(noMidLinePeriod(stream(Array.from(line))));
}
