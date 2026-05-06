import type { Commit, CommitBase, CommitReference } from "conventional-commits-parser";
import { createCommitObject } from "conventional-commits-parser";
import { describe, expect, it } from "vitest";
import { referencesActionEnum } from "../../../src/@commitlint/rules/references-action-enum";

function buildReference(overrides: Partial<CommitReference> = {}): CommitReference {
  return {
    raw: "#1",
    action: null,
    owner: null,
    repository: null,
    issue: "1",
    prefix: "#",
    ...overrides,
  };
}

/**
 * `Commit`は`CommitBase & CommitMeta`の交差型でindex signatureを持つため、リテラルを`Partial<Commit>`に直接渡すと型エラーになる。
 * `Object.assign`で`createCommitObject()`の戻り値に`Partial<CommitBase>`をマージすればキャスト無しで`Commit`値を構築できる。
 */
function buildCommit(references: CommitReference[]): Commit {
  const overrides: Partial<CommitBase> = { header: "feat: x", references };
  return Object.assign(createCommitObject(), overrides);
}

describe("referencesActionEnum", () => {
  it("references配列が空ならpassします。", () => {
    const [valid] = referencesActionEnum(buildCommit([]), "always", ["close", "ref"]);
    expect(valid).toBe(true);
  });

  it("actionがcloseならpassします。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "close" })]), "always", [
      "close",
      "ref",
    ]);
    expect(valid).toBe(true);
  });

  it("actionがrefならpassします。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "ref" })]), "always", ["close", "ref"]);
    expect(valid).toBe(true);
  });

  it("大文字始まりのCloseはケース区別ありで拒否されます。", () => {
    const [valid, message] = referencesActionEnum(buildCommit([buildReference({ action: "Close" })]), "always", [
      "close",
      "ref",
    ]);
    expect(valid).toBe(false);
    expect(message).toBe("references action Close must be one of [close, ref]");
  });

  it("複数形のClosesは拒否されます。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "Closes" })]), "always", [
      "close",
      "ref",
    ]);
    expect(valid).toBe(false);
  });

  it("許可リストに含まれず拒否されます。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "fix" })]), "always", ["close", "ref"]);
    expect(valid).toBe(false);
  });

  it("refsは複数形なので拒否されます。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "refs" })]), "always", ["close", "ref"]);
    expect(valid).toBe(false);
  });

  it("actionがnullの裸の参照はスキップされてpassします。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: null })]), "always", ["close", "ref"]);
    expect(valid).toBe(true);
  });

  it("複数の参照のうち1つでも無効ならfailし、メッセージには違反actionが列挙されます。", () => {
    const [valid, message] = referencesActionEnum(
      buildCommit([
        buildReference({ action: "close" }),
        buildReference({ action: "Fixes" }),
        buildReference({ action: "refs" }),
      ]),
      "always",
      ["close", "ref"],
    );
    expect(valid).toBe(false);
    expect(message).toBe("references action Fixes, refs must be one of [close, ref]");
  });

  it("when=neverでは許可リストに含まれるactionが違反になります。", () => {
    const [valid, message] = referencesActionEnum(buildCommit([buildReference({ action: "close" })]), "never", [
      "close",
      "ref",
    ]);
    expect(valid).toBe(false);
    expect(message).toBe("references action close must not be one of [close, ref]");
  });

  it("when=neverで許可リスト外のactionだけならpassします。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "Closes" })]), "never", [
      "close",
      "ref",
    ]);
    expect(valid).toBe(true);
  });

  it("valueを差し替えると別のactionも許可できます。", () => {
    const [valid] = referencesActionEnum(buildCommit([buildReference({ action: "fix" })]), "always", ["fix"]);
    expect(valid).toBe(true);
  });

  it("空のvalueを渡すと例外になります。", () => {
    expect(() => referencesActionEnum(buildCommit([]), "always", [])).toThrow(
      "references-action-enum: Invalid rule configuration: value must be a non-empty array",
    );
  });

  it("valueが未指定のときも例外になります。", () => {
    expect(() => referencesActionEnum(buildCommit([]), "always", undefined)).toThrow(
      "references-action-enum: Invalid rule configuration: value must be a non-empty array",
    );
  });

  it("whenが不正な値だと例外になります。", () => {
    expect(() => referencesActionEnum(buildCommit([]), undefined, ["close", "ref"])).toThrow(
      "references-action-enum: Invalid rule configuration: when must be 'always' or 'never'",
    );
  });
});
