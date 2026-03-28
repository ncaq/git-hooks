import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";

/**
 * `subject-full-stop`の拡張。
 * 日本語の句読点も含めて制御する。
 * 句読点など記号は無しがデフォルト。
 * インラインコード記法を許可するため特別にバッククオートだけは許可する。
 */
export const subjectAlnumStop: SyncRule<RegExp | undefined> = (
  parsed,
  when = "always",
  value = /[^\p{Letter}\p{Number}`]/u,
) => {
  const header = parsed.header;
  if (header == null) {
    return [true];
  }

  const colonIndex = header.indexOf(":");
  if (colonIndex > 0 && colonIndex === header.length - 1) {
    return [true];
  }

  const lastChar = header.at(-1);
  if (lastChar == null) {
    return [true];
  }

  const negated = when === "never";
  const hasStop = value.test(lastChar);

  return [negated ? !hasStop : hasStop, message(["subject", negated ? "may not" : "must", "end with alnum stop"])];
};
