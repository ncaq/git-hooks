import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { extractLines } from "./body-punctuation/extract-markdown";
import { hasNoMidLinePeriod } from "./body-punctuation/mid-line-period";

/**
 * ルール本体。
 *
 * コミットメッセージ`body`で、句点があるのに改行していない行を抑制するルール。
 *
 * `when="always"`: 各行は行の途中に句点(`.`/`。`/`．`)を含まないことが要求される。
 * 行末の句点は許容され、中間に句点が現れた時点で違反となる。
 * 読点は別ルール`body-comma-needs-break`の担当であり、ここでは無害文字として扱う。
 *
 * 検査対象はmdast上の段落(`paragraph`ノード)に限られる。
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは、
 * 段落として扱われないため対象外。
 * 段落内の`inlineCode`(バッククオート囲み)やリンク・画像の中身も判定の対象外となる。
 *
 * `when`は`always`のみをサポートし、それ以外が指定された場合は例外を投げる。
 */
export const periodNeedsBreak: SyncRule = (parsed, when = "always") => {
  if (when !== "always") {
    throw new Error(`body-period-needs-break only supports when=always, but got when=${when}`);
  }

  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const violations = extractLines(body).filter((line) => !hasNoMidLinePeriod(line));

  if (violations.length === 0) {
    return [true];
  }

  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, "must", "break the line after a period"]),
  ];
};
