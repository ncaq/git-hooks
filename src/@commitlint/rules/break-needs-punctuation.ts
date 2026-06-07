import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { defaultTerminator, extractLines } from "./body-punctuation/shared";

/**
 * ルール本体。
 *
 * コミットメッセージ`body`で、改行があるのに句読点で終わっていない行を抑制するルール。
 *
 * `when="always"`: 各行は行末が`anchoredTerminator`で終わることが要求される。
 * デフォルトはUnicodeのPunctuationプロパティとバッククオートを許可する。
 *
 * 検査対象はmdast上の段落(`paragraph`ノード)に限られる。
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは、
 * 段落として扱われないため対象外。
 * 段落内の`inlineCode`(バッククオート囲み)やリンク・画像はマスクされ、外側のバッククオートが
 * 行末terminatorとして扱われる。
 *
 * `when`は`always`のみをサポートし、それ以外が指定された場合は例外を投げる。
 */
export const breakNeedsPunctuation: SyncRule<RegExp> = (
  parsed,
  when = "always",
  anchoredTerminator = defaultTerminator,
) => {
  if (when !== "always") {
    throw new Error(`body-break-needs-punctuation only supports when=always, but got when=${when}`);
  }

  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const violations = extractLines(body).filter((line) => !anchoredTerminator.test(line));

  if (violations.length === 0) {
    return [true];
  }

  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, "must", "end with punctuation"]),
  ];
};
