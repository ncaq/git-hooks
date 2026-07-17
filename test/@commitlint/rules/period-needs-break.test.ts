import { describe, expect, it } from "vitest";
import { buildCommit } from "./build-commit";
import { periodNeedsBreak } from "#commitlint-rules/period-needs-break";

describe("periodNeedsBreak", () => {
  it("bodyがnullならpassします。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit(null), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("bodyが空文字ならpassします。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit(""), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("句点が行末ならば違反ではありません。", () => {
    const body = `1文目です。
2文目です。`;
    const [valid, msg] = periodNeedsBreak(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("全ての行がピリオドで終わる英文のbodyはpassします。", () => {
    const body = `First line.
Second line.
Third line.`;
    const [valid, msg] = periodNeedsBreak(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("句点が行の途中にあるとfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("1行目です。2行目です。"), "always");
    expect(valid).toBe(false);
  });

  it("英文ピリオドが行の途中にあるとfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("First sentence. Second sentence."), "always");
    expect(valid).toBe(false);
  });

  it("全角句点が行の途中にあるとfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("1行目です．2行目です．"), "always");
    expect(valid).toBe(false);
  });

  it("全角句点が行末ならば違反ではありません。", () => {
    const body = `1行目です．
2行目です．`;
    const [valid, msg] = periodNeedsBreak(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("複数の句点が中間にある単一行はfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("1文目。2文目。3文目。"), "always");
    expect(valid).toBe(false);
  });

  it("コードネーム内のピリオドは中間句点として扱われません。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit("Node.jsのバージョンを更新する。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("バージョン番号内のピリオドは中間句点として扱われません。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit("GHC 9.12に更新する。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("数値の小数点は中間句点として扱われません。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit("処理速度が1.5倍になる。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("単語内ピリオドが複数あってもpassします。", () => {
    const [valid, msg] = periodNeedsBreak(
      buildCommit("Node.jsとGHC 9.12で速度が1.5倍になる。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("単語内ピリオドを含む単語で始まる行もpassします。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit("1.5倍の速度になる。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("非ASCII文字に挟まれた半角ピリオドはfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("1文目です.2文目です。"), "always");
    expect(valid).toBe(false);
  });

  it("英数字に挟まれていても全角句点はfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("Node。jsを更新する。"), "always");
    expect(valid).toBe(false);
  });

  it("ピリオドの後に空白が続く場合はfailします。", () => {
    const [valid] = periodNeedsBreak(buildCommit("Update Node.js. And more."), "always");
    expect(valid).toBe(false);
  });

  it("読点が行の途中にあっても句点観点ではpassします。", () => {
    const [valid, msg] = periodNeedsBreak(
      buildCommit("とても長い前置きを書いた後で、続きを書きます。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("インラインコード内のドットは中間句読点として扱われません。", () => {
    const [valid, msg] = periodNeedsBreak(
      buildCommit("`foo.bar = enable;`の時はhogeを実行する。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("インラインコード内の全角句点は中間句読点として扱われません。", () => {
    const [valid, msg] = periodNeedsBreak(
      buildCommit("`これは。コード内の。句点です。`を例として示す。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("インラインコード外の中間句点はそのままfailします。", () => {
    const [valid] = periodNeedsBreak(
      buildCommit("`foo.bar`を実行する。続けて。次の処理。"),
      "always",
    );
    expect(valid).toBe(false);
  });

  it("Markdownリンク記法のタイトルに句点が含まれていてもpassします。", () => {
    const [valid, msg] = periodNeedsBreak(
      buildCommit("[これはタイトル。です](https://example.com/)を参照。"),
      "always",
    );
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("when=always以外は未サポートで例外を投げます。", () => {
    expect(() => periodNeedsBreak(buildCommit("ends with period."), "never")).toThrow();
  });

  it("単一違反のメッセージは指定の構造を持ちます。", () => {
    const [valid, msg] = periodNeedsBreak(buildCommit("1行目です。2行目です。"), "always");
    expect(valid).toBe(false);
    expect(msg).toBe("body lines [1行目です。2行目です。] must break the line after a period");
  });

  it("複数違反は違反行を` / `で結合します。", () => {
    const body = `1行目です。2行目も。
3行目です。4行目も。`;
    const [valid, msg] = periodNeedsBreak(buildCommit(body), "always");
    expect(valid).toBe(false);
    expect(msg).toBe(
      "body lines [1行目です。2行目も。 / 3行目です。4行目も。] must break the line after a period",
    );
  });
});
