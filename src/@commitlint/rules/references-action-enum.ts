import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";

/**
 * issue参照に使えるアクションキーワードを限定します。
 * `parsed.references[].action`が許可リストに完全一致するかをケース区別ありで検査します。
 * `action`が`null`(キーワード無しの裸の`#83`等)はスキップします。
 */
export const referencesActionEnum: SyncRule<readonly string[]> = (parsed, when, value) => {
  if (when !== "always" && when !== "never") {
    throw new Error("references-action-enum: Invalid rule configuration: when must be 'always' or 'never'");
  }

  if (value == null || value.length === 0) {
    throw new Error("references-action-enum: Invalid rule configuration: value must be a non-empty array");
  }

  const references = parsed.references;
  if (references == null || references.length === 0) {
    return [true];
  }

  const negated = when === "never";
  const mustOrMustNot = negated ? "must not" : "must";

  const violations = references.filter(
    (reference) =>
      reference.action != null && (negated ? value.includes(reference.action) : !value.includes(reference.action)),
  );
  const hasViolation = 0 < violations.length;
  const violationsActions = violations.map((reference) => reference.action).join(", ");

  const ruleValues = value.join(", ");

  return [
    negated ? hasViolation : !hasViolation,
    message([`references action ${violationsActions}`, mustOrMustNot, `be one of [${ruleValues}]`]),
  ];
};
