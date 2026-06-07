import { createCommitObject, type Commit } from "conventional-commits-parser";
import { describe, expect, it } from "vitest";
import { commaNeedsBreak } from "#commitlint-rules/comma-needs-break";

function buildCommit(body: string | null): Commit {
  return createCommitObject({ header: "feat: x", body });
}

describe("commaNeedsBreak", () => {
  it("bodyがnullならpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit(null), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("bodyが空文字ならpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit(""), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("読点で終わって続く行もpassします。", () => {
    const body = `読点で終わって、
次の行に続く。`;
    const [valid, msg] = commaNeedsBreak(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("カンマで終わって続く行もpassします。", () => {
    const body = `ends with comma,
next line.`;
    const [valid, msg] = commaNeedsBreak(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("全角カンマで終わる行はpassします。", () => {
    const body = `読点で終わる，
次の行に続く．`;
    const [valid, msg] = commaNeedsBreak(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("読点が行の途中で前置文字が短ければpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit("また、続きを書きます。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("読点が行の途中で前置文字が長いとfailします。", () => {
    const [valid] = commaNeedsBreak(
      buildCommit("とても長い前置きを書いた後で、続きを書きます。"),
      "always",
    );
    expect(valid).toBe(false);
  });

  it("読点の前置文字が閾値未満(5文字)ならpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit("あいうえお、続きます。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("読点の前置文字が閾値ちょうど(6文字)ならfailします。", () => {
    const [valid] = commaNeedsBreak(buildCommit("あいうえおか、続きます。"), "always");
    expect(valid).toBe(false);
  });

  it("英文カンマが行の途中で前置文字が短ければpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit("Hi, world."), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("英文カンマが行の途中で前置文字が長いとfailします。", () => {
    const [valid] = commaNeedsBreak(
      buildCommit("This is a very long preamble, and the rest continues."),
      "always",
    );
    expect(valid).toBe(false);
  });

  it("英文カンマの前置文字が閾値未満(5文字)ならpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit("12345, rest of the line."), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("英文カンマの前置文字が閾値ちょうど(6文字)ならfailします。", () => {
    const [valid] = commaNeedsBreak(buildCommit("123456, rest of the line."), "always");
    expect(valid).toBe(false);
  });

  it("全角カンマの前置文字が閾値未満(5文字)ならpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit("あいうえお，続きます。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("全角カンマの前置文字が閾値ちょうど(6文字)ならfailします。", () => {
    const [valid] = commaNeedsBreak(buildCommit("あいうえおか，続きます。"), "always");
    expect(valid).toBe(false);
  });

  it("句点が行の途中にあっても読点観点ではpassします。", () => {
    const [valid, msg] = commaNeedsBreak(buildCommit("1行目です。2行目です。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("インラインコード内のカンマは中間句読点として扱われません。", () => {
    const [valid, msg] = commaNeedsBreak(
      buildCommit("`fn(a, b, c, d, e, f, g)`を呼び出す。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("Markdownリンク記法のタイトルにカンマが含まれていてもpassします。", () => {
    const [valid, msg] = commaNeedsBreak(
      buildCommit("[Hello, world](https://example.com/)を参照。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("when=always以外は未サポートで例外を投げます。", () => {
    expect(() => commaNeedsBreak(buildCommit("ends with period."), "never")).toThrow();
  });

  it("単一違反のメッセージは指定の構造を持ちます。", () => {
    const [valid, msg] = commaNeedsBreak(
      buildCommit("とても長い前置きを書いた後で、続きます。"),
      "always",
    );
    expect(valid).toBe(false);
    expect(msg).toBe(
      "body lines [とても長い前置きを書いた後で、続きます。] must break the line after a comma",
    );
  });

  it("複数違反は違反行を` / `で結合します。", () => {
    const body = `とても長い前置きを書いた後で、続く。
別の長い前置きを書いた後で、また続く。`;
    const [valid, msg] = commaNeedsBreak(buildCommit(body), "always");
    expect(valid).toBe(false);
    expect(msg).toBe(
      "body lines [とても長い前置きを書いた後で、続く。 / 別の長い前置きを書いた後で、また続く。] must break the line after a comma",
    );
  });
});
