import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";

/**
 * issue参照に使えるアクションキーワードを限定します。
 * `parsed.references[].action`が許可リストに完全一致するかをケース区別ありで検査します。
 * `action`が`null`(キーワード無しの裸の`#83`等)はスキップします。
 */
export const referencesActionEnum: SyncRule<readonly string[]> = (parsed, when, value) => {
  if (value == null || value.length === 0) {
    throw new Error("Invalid rule configuration: value must be a non-empty array");
  }

  const references = parsed.references;
  if (references == null || references.length === 0) {
    return [true];
  }

  const violations = references.filter((reference) => reference.action != null && !value.includes(reference.action));
  const negated = when === "never";
  const hasViolation = 0 < violations.length;

  return [
    negated ? hasViolation : !hasViolation,
    message(["references action", negated ? "must not" : "must", `be one of [${value.join(", ")}]`]),
  ];
};
