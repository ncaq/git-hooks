import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
const commaPrefixThreshold = 5 as const;

/**
 * 行末以外に出現する句点を検出する。改行を伴わない句点は違反扱い。
 */
const midLinePeriodPattern = /[.。．](?!$)/u;

/**
 * 行末以外で、かつ前置文字数が`commaPrefixThreshold`以上の読点を検出する。
 */
const midLineCommaPattern = new RegExp(`(?<=.{${commaPrefixThreshold},})[,，、](?!$)`, "u");

/**
 * 行末として許容する終端文字のデフォルト集合。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
const defaultTerminator = /[\p{P}`]/u;

/**
 * Markdownのリスト項目を判定する。インデントされたネストリストにも対応する。
 */
const listPattern = /^\s*([-*+]|\d+\.)\s/u;

/**
 * Markdownの引用ブロックを判定する。
 * 引用部分はオリジナルの文章を保つ必要があるため検査対象外とする。
 */
const quotePattern = /^\s*>/u;

/**
 * 行とそれがコードフェンス領域(フェンス自身を含む)に属するかのフラグの組。
 */
type AnnotatedLine = readonly [line: string, inCodeBlock: boolean];

/**
 * 行配列を走査し、各行をコードフェンス領域フラグ付きの組に変換する。
 * フェンス行自身も領域として扱い、後続処理で添字アクセス無しに行を識別できるようにする。
 */
interface ScanState {
  readonly inBlock: boolean;
  readonly annotated: readonly AnnotatedLine[];
}

function annotateCodeBlock(lines: readonly string[]): readonly AnnotatedLine[] {
  const initial: ScanState = { inBlock: false, annotated: [] };
  return lines.reduce<ScanState>((state, line) => {
    const isFence = line.startsWith("```");
    const entry: AnnotatedLine = [line, isFence || state.inBlock];
    return {
      inBlock: isFence ? !state.inBlock : state.inBlock,
      annotated: [...state.annotated, entry],
    };
  }, initial).annotated;
}

/**
 * 検査対象外の行(空行・リスト項目・引用ブロック)を判定する。
 */
function isExemptLine(line: string): boolean {
  return line === "" || listPattern.test(line) || quotePattern.test(line);
}

/**
 * 行内に句点や条件付きの読点が出現するかを正規表現マッチで判定する。
 */
function hasMidLinePunctuation(line: string): boolean {
  return midLinePeriodPattern.test(line) || midLineCommaPattern.test(line);
}

/**
 * 個別の行が違反であるかを判定する。
 * `negated`が真のとき終端の有無のみで判定し、偽のときは中間句読点も併せて判定する。
 */
function isLineViolation(line: string, anchoredTerminator: RegExp, negated: boolean): boolean {
  const endsWithTerminator = anchoredTerminator.test(line);
  if (negated) {
    return endsWithTerminator;
  }
  return !endsWithTerminator || hasMidLinePunctuation(line);
}

/**
 * 与えられた終端文字の正規表現を、行末アンカー付きの正規表現に変換する。
 * 行から最後の文字を取り出して`test`する逐次操作を回避し、
 * 正規表現のマッチング機能のみで行末判定を完結させる。
 */
function anchorAtEnd(terminator: RegExp): RegExp {
  return new RegExp(`(?:${terminator.source})$`, "u");
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
  const annotatedLines = annotateCodeBlock(body.split("\n"));

  const violations = annotatedLines
    .filter(([line, inCodeBlock]) => !inCodeBlock && !isExemptLine(line))
    .map(([line]) => line)
    .filter((line) => isLineViolation(line, anchoredTerminator, negated));

  if (violations.length === 0) {
    return [true];
  }

  const verb = negated ? "must not" : "must";
  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, verb, "end with punctuation and break after sentences"]),
  ];
};
