import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream, type Stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";
import * as S from "parser-ts/string";

type Char = C.Char;

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
const commaPrefixThreshold = 5 as const;

const periodChars = ".。．" as const;
const commaChars = ",，、" as const;

const isPeriod = (c: Char): boolean => periodChars.includes(c);
const isComma = (c: Char): boolean => commaChars.includes(c);

/**
 * 行末として許容する終端文字のデフォルト集合。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
const defaultTerminator = /[\p{P}`]/u;

/** Markdownのリスト項目を判定する。インデントされたネストリストにも対応する。 */
const listPattern = /^\s*([-*+]|\d+\.)\s/u;

/** Markdownの引用ブロックを判定する。引用部分は検査対象外とする。 */
const quotePattern = /^\s*>/u;

/** 検査対象外の行(空行・リスト項目・引用ブロック)を判定する。 */
function isExemptLine(line: string): boolean {
  return line === "" || listPattern.test(line) || quotePattern.test(line);
}

/** 与えられた終端文字の正規表現を、行末アンカー付きの正規表現に変換する。 */
function anchorAtEnd(terminator: RegExp): RegExp {
  return new RegExp(`(?:${terminator.source})$`, "u");
}

// ---- body 全体のパーサ ---------------------------------------------------
//
// body         := block*
// block        := codeBlock | normalLine
// codeBlock    := fenceLine anyLine* (fenceLine | EOF)
// normalLine   := anyLine
// anyLine      := <any non-newline char>* (newline | EOF)
// fenceLine    := "```" anyLine
//
// codeBlock 内の行はすべて検査対象外として扱い、normalLine のみが行文字列を吐き出す。

/** 行末(改行 or 入力終端)。 */
const lineEnd: P.Parser<Char, void> = P.either(
  pipe(
    C.char("\n"),
    P.map<Char, void>(() => undefined),
  ),
  () => P.eof<Char>(),
);

/** 1行(改行を含めて消費し、改行を除いた文字列を返す)。 */
const anyLine: P.Parser<Char, string> = pipe(C.many(C.notChar("\n")), P.apFirst(lineEnd));

/** 開始フェンス行。`"```"`から始まる行を1行として消費する。 */
const fenceLine: P.Parser<Char, string> = pipe(
  S.string("```"),
  P.chain((prefix) =>
    pipe(
      anyLine,
      P.map((rest) => prefix + rest),
    ),
  ),
);

/** コードブロックの終端(閉じフェンス、または入力終端)。 */
const fenceCloseOrEof: P.Parser<Char, void> = P.either(
  pipe(
    fenceLine,
    P.map<string, void>(() => undefined),
  ),
  () => P.eof<Char>(),
);

/** コードブロック1個。中身は検査対象外なので、空配列を返す。 */
const codeBlock: P.Parser<Char, readonly string[]> = pipe(
  fenceLine,
  P.chain(() =>
    pipe(
      P.manyTill(anyLine, fenceCloseOrEof),
      P.map((): readonly string[] => []),
    ),
  ),
);

/** 通常の1行。検査対象としてその行文字列を返す。 */
const normalLine: P.Parser<Char, readonly string[]> = pipe(
  anyLine,
  P.map((line): readonly string[] => [line]),
);

/**
 * `many`が空消費で無限ループに陥らないよう、入力終端では失敗させるブロックパーサ。
 */
const block: P.Parser<Char, readonly string[]> = pipe(
  P.lookAhead(P.item<Char>()),
  P.chain(() => P.either(codeBlock, () => normalLine)),
);

/** body全体を行配列に変換するパーサ。検査対象になる行のみを残す。 */
const bodyToLines: P.Parser<Char, readonly string[]> = pipe(
  P.many(block),
  P.map((blocks) => blocks.flat()),
);

// ---- 1行の中間句読点の検査 ----------------------------------------------
//
// 行を1ストリームとみなして、最後の文字を残しつつ前方の文字を「中間として安全な文字」として消費する。
// 安全とは「句点ではなく、かつ位置が`commaPrefixThreshold`未満であるか読点でない」こと。

/** 残り2文字以上あることを先読みで確認する(消費はしない)。 */
const hasNextChar: P.Parser<Char, void> = P.lookAhead(
  pipe(
    P.item<Char>(),
    P.chain(() => P.item<Char>()),
    P.map<Char, void>(() => undefined),
  ),
);

/**
 * 中間として安全な1文字を消費する。
 *
 * - 残り1文字以下のときは「最終文字」とみなしてここでは消費しない。
 * - 句点であれば中間禁止なので失敗。
 * - 読点で位置が`commaPrefixThreshold`以上なら中間禁止なので失敗。
 */
const midLineSafeChar: P.Parser<Char, Char> = pipe(
  hasNextChar,
  P.chain(() =>
    pipe(
      P.withStart(P.item<Char>()),
      P.filter(([ch, start]: [Char, Stream<Char>]) => {
        if (isPeriod(ch)) return false;
        if (isComma(ch) && start.cursor >= commaPrefixThreshold) return false;
        return true;
      }),
      P.map(([ch]) => ch),
    ),
  ),
);

/**
 * 行を「中間禁止文字なし」として読み切るパーサ。
 *
 * 中間文字を可能な限り消費した後、最終1文字を任意の文字として消費する(空行は許容)。
 */
const noMidLinePunctuation: P.Parser<Char, void> = pipe(
  P.many(midLineSafeChar),
  P.chain(() =>
    P.either(
      pipe(
        P.eof<Char>(),
        P.map<void, void>(() => undefined),
      ),
      () =>
        pipe(
          P.item<Char>(),
          P.chainFirst(() => P.eof<Char>()),
          P.map<Char, void>(() => undefined),
        ),
    ),
  ),
);

/** 行に中間句読点が無いかを判定する。 */
function hasNoMidLinePunctuation(line: string): boolean {
  const result = noMidLinePunctuation(stream(Array.from(line)));
  return isRight(result);
}

// ---- ルール本体 ----------------------------------------------------------

/**
 * 個別の行が違反であるかを判定する。
 *
 * `negated`が真のとき終端の有無のみで判定し、偽のときは中間句読点も併せて判定する。
 */
function isLineViolation(line: string, anchoredTerminator: RegExp, negated: boolean): boolean {
  const endsWithTerminator = anchoredTerminator.test(line);
  if (negated) {
    return endsWithTerminator;
  }
  return !endsWithTerminator || !hasNoMidLinePunctuation(line);
}

/**
 * コミットメッセージ`body`の唐突な改行を抑制するルール。
 *
 * `when="always"`: 各行は次の双方を満たす必要がある。
 * - 行末が`value`の終端文字で終わる
 * - 行の途中に句点(`.`/`。`/`．`)が無い
 * - 行の途中の読点(`,`/`，`/`、`)は前置文字数が閾値以下のときのみ許容する
 *
 * 空行・リスト項目(`-`/`*`/`+`/番号付き)・コードフェンス内・引用ブロックは対象外。
 *
 * `when="never"`: 行末が`value`の終端文字で終わる行を違反とする。
 */
export const bodyLineBreakPunctuation: SyncRule<RegExp> = (parsed, when = "always", value = defaultTerminator) => {
  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const negated = when === "never";
  const anchoredTerminator = anchorAtEnd(value);

  const parsedBody = bodyToLines(stream(Array.from(body)));
  const lines: readonly string[] = isRight(parsedBody) ? parsedBody.right.value : [];

  const violations = lines.filter((line) => !isExemptLine(line) && isLineViolation(line, anchoredTerminator, negated));

  if (violations.length === 0) {
    return [true];
  }

  const verb = negated ? "must not" : "must";
  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, verb, "end with punctuation and break after sentences"]),
  ];
};
