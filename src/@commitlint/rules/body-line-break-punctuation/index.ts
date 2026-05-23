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
function isLineViolation(line: string, anchoredTerminator: RegExp): boolean {
  return !anchoredTerminator.test(line) || !hasNoMidLinePunctuation(line);
}

/** 文字列から違反行を取り出す。 */
function selectViolations(body: string, anchoredTerminator: RegExp): readonly string[] {
  return extractLines(body).filter((line) => isLineViolation(line, anchoredTerminator));
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
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは、
 * 段落として扱われないため対象外。
 * リスト項目直後の行は遅延継続でリスト項目内に取り込まれるため対象外となる。
 * 段落内の`inlineCode`(バッククオート囲み)の中身も中間句読点判定の対象外となる。
 *
 * `when`は`always`のみをサポートし、それ以外が指定された場合は例外を投げる。
 */
export const bodyLineBreakPunctuation: SyncRule<RegExp> = (
  parsed,
  when = "always",
  anchoredTerminator = defaultTerminator,
) => {
  if (when !== "always") {
    throw new Error(`body-line-break-punctuation only supports when=always, but got when=${when}`);
  }

  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const violations = selectViolations(body, anchoredTerminator);

  if (violations.length === 0) {
    return [true];
  }

  return [
    false,
    message([
      `body lines [${violations.join(" / ")}]`,
      "must",
      "end with punctuation and break after sentences",
    ]),
  ];
};
