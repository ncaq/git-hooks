import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";

/**
 * issue参照に使えるアクションキーワードを限定します。
 * `parsed.references[].action`をリストによりケース区別ありで検査します。
 * `action`が`null`(キーワード無しの裸の`#83`等)はスキップします。
 *
 * `when="always"`: `value`に含まれるアクションのみ許可し、それ以外を違反とする。
 * `when="never"`: `value`に含まれるアクションを禁止し、それ以外を許可する。
 */
export const referencesActionEnum: SyncRule<readonly string[]> = (parsed, when, value) => {
  if (when !== "always" && when !== "never") {
    throw new Error("references-action-enum: Invalid rule configuration: when must be 'always' or 'never'");
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("references-action-enum: Invalid rule configuration: value must be a non-empty array");
  }

  const references = parsed.references;
  if (!Array.isArray(references) || references.length === 0) {
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
    !hasViolation,
    message([`references action ${violationsActions}`, mustOrMustNot, `be one of [${ruleValues}]`]),
  ];
};
