import { createCommitObject, type Commit } from "conventional-commits-parser";
import { describe, expect, it } from "vitest";
import { subjectAlnumStop } from "../../../src/@commitlint/rules/subject-alnum-stop";

function buildCommit(header: string | null): Commit {
  return createCommitObject({ header });
}

describe("subjectAlnumStop", () => {
  it("headerがnullならpassします。", () => {
    const [valid] = subjectAlnumStop(buildCommit(null), "never");
    expect(valid).toBe(true);
  });

  it("コロンで終わるheaderはpassします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("WIP:"), "never");
    expect(valid).toBe(true);
  });

  it("英字で終わるheaderはwhen=neverでpassします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: add foo"), "never");
    expect(valid).toBe(true);
  });

  it("数字で終わるheaderはwhen=neverでpassします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: bump to v2"), "never");
    expect(valid).toBe(true);
  });

  it("日本語の漢字で終わるheaderはwhen=neverでpassします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: 機能を追加"), "never");
    expect(valid).toBe(true);
  });

  it("バッククオートで終わるheaderはwhen=neverでpassします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: rename `foo`"), "never");
    expect(valid).toBe(true);
  });

  it("ピリオドで終わるheaderはwhen=neverでfailします。", () => {
    const [valid, message] = subjectAlnumStop(buildCommit("feat: add foo."), "never");
    expect(valid).toBe(false);
    expect(message).toBe("subject may not end with alnum stop");
  });

  it("日本語の句点で終わるheaderはwhen=neverでfailします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: 機能を追加。"), "never");
    expect(valid).toBe(false);
  });

  it("読点で終わるheaderはwhen=neverでfailします。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: 追加、"), "never");
    expect(valid).toBe(false);
  });

  it("when=alwaysでは句読点で終わることが要求されます。", () => {
    const [valid] = subjectAlnumStop(buildCommit("feat: add foo."), "always");
    expect(valid).toBe(true);
  });

  it("when=alwaysで英字終わりはfailします。", () => {
    const [valid, message] = subjectAlnumStop(buildCommit("feat: add foo"), "always");
    expect(valid).toBe(false);
    expect(message).toBe("subject must end with alnum stop");
  });

  it("カスタム正規表現でセミコロンのみ判定対象にできます。", () => {
    const onlySemicolon = /;/u;
    const [validSemicolon] = subjectAlnumStop(buildCommit("feat: foo;"), "never", onlySemicolon);
    expect(validSemicolon).toBe(false);
    const [validPeriod] = subjectAlnumStop(buildCommit("feat: foo."), "never", onlySemicolon);
    expect(validPeriod).toBe(true);
  });
});
