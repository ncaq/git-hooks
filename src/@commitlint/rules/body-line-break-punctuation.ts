import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import type { Root } from "mdast";
import { fromMarkdown, type Options as fromMarkdownOptions } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import * as P from "parser-ts/Parser";
import { stream, type Stream } from "parser-ts/Stream";
import { type Char } from "parser-ts/char";

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
const commaPrefixThreshold = 6 as const;

const periodChars = ".。．" as const;
const commaChars = ",，、" as const;

function isPeriod(c: Char): boolean {
  return periodChars.includes(c);
}

function isComma(c: Char): boolean {
  return commaChars.includes(c);
}

/**
 * 行末として許容する終端文字のデフォルト集合。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
const defaultTerminator = /[\p{P}`]/u;

/** 与えられた終端文字の正規表現を、行末アンカー付きの正規表現に変換する。 */
function anchorAtEnd(terminator: RegExp): RegExp {
  return new RegExp(`(?:${terminator.source})$`, "u");
}

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
 * コミットメッセージで受け付けるマークダウンの設定。
 * `readonly`を受け付けないので`as const`は使えない。
 */
const fromMarkdownOptions: fromMarkdownOptions = { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] };

/**
 * bodyから検査対象となる段落の各行を、出現順に抽出する。
 * bodyをMarkdown(GFM拡張込み)としてパースし、
 * ルートノードの段落のみを対象に元のソースから該当行を切り出す。
 * リスト・引用・コードブロック・見出し(ATX/setext)・水平線・テーブルなどは、
 * `paragraph`ノードにならないため、
 * この抽出から自然に除外される。
 * リスト項目や引用ブロック内部にネストする段落も、
 * ルート直下ではないので対象外となる。
 */
function extractParagraphLines(body: string): readonly string[] {
  const tree: Root = fromMarkdown(body, fromMarkdownOptions);
  const sourceLines = body.split("\n");
  return tree.children.flatMap((child) => {
    if (child.type !== "paragraph" || child.position == null) {
      return [];
    }
    const startLine = child.position.start.line - 1;
    const endLine = child.position.end.line - 1;
    return sourceLines.slice(startLine, endLine + 1);
  });
}

/**
 * ルール本体。
 *
 * コミットメッセージ`body`の唐突な改行を抑制するルール。
 *
 * `when="always"`: 各行は以下の条件を全て満たす必要がある。
 * - 行末が`value`の終端文字で終わる
 * - 行の途中に句点(`.`/`。`/`．`)が無い
 * - 行の途中の読点(`,`/`，`/`、`)は前置文字数が閾値未満のときのみ許容する
 *
 * 検査対象はmdast上の段落(`paragraph`ノード)に限られる。
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは段落として扱われないため対象外。
 * リスト項目直後の行は遅延継続でリスト項目内に取り込まれるため対象外となる。
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

  const violations = extractParagraphLines(body).filter((line) => isLineViolation(line, anchoredTerminator, negated));

  if (violations.length === 0) {
    return [true];
  }

  const verb = negated ? "must not" : "must";
  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, verb, "end with punctuation and break after sentences"]),
  ];
};
