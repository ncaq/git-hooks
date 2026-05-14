import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { extractLines } from "./extract-markdown";
import { hasNoMidLinePunctuation } from "./mid-line-punctuation";

/**
 * 行末として許容する終端正規表現。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
const defaultTerminator = /(?:[\p{P}`])$/u;

/** 個別の行が違反であるかを判定する。 */
function isLineViolation(line: string, negated: boolean, anchoredTerminator: RegExp): boolean {
  const endsWithTerminator = anchoredTerminator.test(line);
  if (negated) {
    return endsWithTerminator;
  }
  return !endsWithTerminator || !hasNoMidLinePunctuation(line);
}

/** 文字列から違反行を取り出す。 */
function selectViolations(
  body: string,
  negated: boolean,
  anchoredTerminator: RegExp,
): readonly string[] {
  return extractLines(body).filter((line) => isLineViolation(line, negated, anchoredTerminator));
}

/**
 * ルール本体。
 *
 * コミットメッセージ`body`の唐突な改行を抑制するルール。
 *
 * `when="always"`: 各行は以下の条件を全て満たす必要がある。
 * - 行末が`anchoredTerminator`で終わる
 * - 行の途中に句点(`.`/`。`/`．`)が無い
 * - 行の途中の読点(`,`/`，`/`、`)は前置文字数が閾値未満のときのみ許容する
 *
 * 検査対象はmdast上の段落(`paragraph`ノード)に限られる。
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは段落として扱われないため対象外。
 * リスト項目直後の行は遅延継続でリスト項目内に取り込まれるため対象外となる。
 * 段落内の`inlineCode`(バッククオート囲み)の中身も中間句読点判定の対象外となる。
 *
 * `when="never"`: 行末が`anchoredTerminator`で終わる行を違反とする。
 * neverモードの実用性が全く分からないので、
 * 一応慣習に従って実装はしますが、
 * 真面目に検査していません。
 */
export const bodyLineBreakPunctuation: SyncRule<RegExp> = (
  parsed,
  when = "always",
  anchoredTerminator = defaultTerminator,
) => {
  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const negated = when === "never";

  const violations = selectViolations(body, negated, anchoredTerminator);

  if (violations.length === 0) {
    return [true];
  }

  const verb = negated ? "must not" : "must";
  return [
    false,
    message([
      `body lines [${violations.join(" / ")}]`,
      verb,
      "end with punctuation and break after sentences",
    ]),
  ];
};
