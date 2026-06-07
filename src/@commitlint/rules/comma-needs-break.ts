import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { extractLines } from "./body-punctuation/extract-markdown";
import { hasMidLineComma } from "./body-punctuation/mid-line-comma";

/**
 * ルール本体。
 *
 * コミットメッセージ`body`で、読点があるのに改行していない行を抑制するルール。
 *
 * `when="always"`: 各行は行の途中に読点(`,`/`，`/`、`)を含まないことが要求される。
 * ただし前置文字数が閾値未満の読点(`また、`等の短い接続詞)は許容する。
 * 句点は別ルール`body-period-needs-break`の担当であり、ここでは無害文字として扱う。
 *
 * 検査対象はmdast上の段落(`paragraph`ノード)に限られる。
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは、
 * 段落として扱われないため対象外。
 * 段落内の`inlineCode`(バッククオート囲み)やリンク・画像の中身も判定の対象外となる。
 *
 * `when`は`always`のみをサポートし、それ以外が指定された場合は例外を投げる。
 */
export const commaNeedsBreak: SyncRule = (parsed, when = "always") => {
  if (when !== "always") {
    throw new Error(`body-comma-needs-break only supports when=always, but got when=${when}`);
  }

  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const violations = extractLines(body).filter((line) => hasMidLineComma(line));

  if (violations.length === 0) {
    return [true];
  }

  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, "must", "break the line after a comma"]),
  ];
};
