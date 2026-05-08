import { createCommitObject, type Commit } from "conventional-commits-parser";
import { describe, expect, it } from "vitest";
import { bodyLineBreakPunctuation } from "../../../src/@commitlint/rules/body-line-break-punctuation";

function buildCommit(body: string | null): Commit {
  return createCommitObject({ header: "feat: x", body });
}

describe("bodyLineBreakPunctuation", () => {
  it("bodyがnullならpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit(null), "always");
    expect(valid).toBe(true);
  });

  it("bodyが空文字ならpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit(""), "always");
    expect(valid).toBe(true);
  });

  it("単一行で句点で終わるbodyはpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("単一行で句点で終わる。"), "always");
    expect(valid).toBe(true);
  });

  it("単一行で句読点なしのbodyはfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("単一行で句読点なし"), "always");
    expect(valid).toBe(false);
  });

  it("全ての行が句点で終わる日本語のbodyはpassします。", () => {
    const body = `1行目です。
2行目です。
3行目です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("全ての行がピリオドで終わる英文のbodyはpassします。", () => {
    const body = `First line.
Second line.
Third line.`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("読点で終わって続く行もpassします。", () => {
    const body = `読点で終わって、
次の行に続く。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("カンマで終わって続く行もpassします。", () => {
    const body = `ends with comma,
next line.`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("疑問符で終わる行はpassします。", () => {
    const body = `本当ですか？
本当です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("感嘆符で終わる行はpassします。", () => {
    const body = `Wow!
それは凄い。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("最終行も句読点で終わることが要求されます。", () => {
    const body = `前の行は句点で終わる。
最後の行は句読点なし`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("句読点なしで唐突に改行する日本語はfailします。", () => {
    const body = `句読点のない
唐突な改行は禁止。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("句読点なしで改行する英文はfailします。", () => {
    const body = `no punctuation here
but still continues.`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("途中の行が句読点で終わらないとfailします。", () => {
    const body = `1行目は句点。
2行目に句読点なし
3行目に続く。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("空行はそれ自身は対象外です。", () => {
    const body = `段落1の終わり。

段落2の始まり。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("段落最後の行が句読点なしならfailします(空行の前の行)。", () => {
    const body = `段落1は句点なしで終わる

段落2は句点で終わる。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("ハイフンで始まるリスト項目は対象外です。", () => {
    const body = `リスト:

- 項目1
- 項目2
- 項目3`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("アスタリスクで始まるリスト項目は対象外です。", () => {
    const body = `リスト:

* 項目1
* 項目2
* 項目3`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("プラス記号で始まるリスト項目は対象外です。", () => {
    const body = `リスト:

+ 項目1
+ 項目2
+ 項目3`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("番号付きリスト項目は対象外です。", () => {
    const body = `手順:

1. 最初
2. 次
3. 最後`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("インデントされたリスト項目も対象外です。", () => {
    const body = `ネスト:

- 親項目
  - 子項目1
  - 子項目2`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("コードブロック内は対象外です。", () => {
    const body = `コード例:

\`\`\`
function foo() {
  return 42
}
\`\`\`

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("言語指定付きのコードブロック内も対象外です。", () => {
    const body = `コード例:

\`\`\`typescript
const x = 1
const y = 2
\`\`\`

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("コードブロックの直前の行が句読点なしならfailします。", () => {
    const body = `コード例

\`\`\`
const x = 1
\`\`\`

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("コードブロックが閉じていないと内部扱いとなり後続も無視されます。", () => {
    const body = `始まり:

\`\`\`
const x = 1
const y = 2`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("コロンで終わる行はpassします。", () => {
    const body = `次の通りです:

- 項目`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("セミコロンで終わる行はpassします。", () => {
    const body = `first part;
second part.`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("複数違反はメッセージで全て列挙されます。", () => {
    const body = `違反1の行
違反2の行
句点で終わる。`;
    const [valid, msg] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
    expect(msg).toContain("違反1の行");
    expect(msg).toContain("違反2の行");
  });

  it("カスタム正規表現で句点のみ許可するとカンマ終わりはfailします。", () => {
    const onlyPeriod = /[.。]/u;
    const body = `ends with comma,
next line.`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always", onlyPeriod);
    expect(valid).toBe(false);
  });

  it("when=neverでは句読点で終わる行が違反になります。", () => {
    const body = `ends with period.
next line.`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "never");
    expect(valid).toBe(false);
  });

  it("when=neverで句読点なしの行はpassします。", () => {
    const body = `no punctuation
next line`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "never");
    expect(valid).toBe(true);
  });

  it("句点が行の途中にあるとfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("1行目です。2行目です。"), "always");
    expect(valid).toBe(false);
  });

  it("英文ピリオドが行の途中にあるとfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("First sentence. Second sentence."), "always");
    expect(valid).toBe(false);
  });

  it("読点が行の途中で前置文字が短ければpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("また、続きを書きます。"), "always");
    expect(valid).toBe(true);
  });

  it("読点が行の途中で前置文字が長いとfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("とても長い前置きを書いた後で、続きを書きます。"), "always");
    expect(valid).toBe(false);
  });

  it("読点の前置文字が閾値未満(5文字)ならpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("あいうえお、続きます。"), "always");
    expect(valid).toBe(true);
  });

  it("読点の前置文字が閾値ちょうど(6文字)ならfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("あいうえおか、続きます。"), "always");
    expect(valid).toBe(false);
  });

  it("英文カンマが行の途中で前置文字が短ければpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("Hi, world."), "always");
    expect(valid).toBe(true);
  });

  it("英文カンマが行の途中で前置文字が長いとfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(
      buildCommit("This is a very long preamble, and the rest continues."),
      "always",
    );
    expect(valid).toBe(false);
  });

  it("英文カンマの前置文字が閾値未満(5文字)ならpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("12345, rest of the line."), "always");
    expect(valid).toBe(true);
  });

  it("英文カンマの前置文字が閾値ちょうど(6文字)ならfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("123456, rest of the line."), "always");
    expect(valid).toBe(false);
  });

  it("全角カンマの前置文字が閾値未満(5文字)ならpassします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("あいうえお，続きます。"), "always");
    expect(valid).toBe(true);
  });

  it("全角カンマの前置文字が閾値ちょうど(6文字)ならfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("あいうえおか，続きます。"), "always");
    expect(valid).toBe(false);
  });

  it("コロンが行の途中にあるのは許容されます。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("key: value here."), "always");
    expect(valid).toBe(true);
  });

  it("セミコロンが行の途中にあるのは許容されます。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("first; second; third."), "always");
    expect(valid).toBe(true);
  });

  it("疑問符が行の途中にあるのは許容されます。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("Really? Yes indeed."), "always");
    expect(valid).toBe(true);
  });

  it("感嘆符が行の途中にあるのは許容されます。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("Wow! Amazing thing!"), "always");
    expect(valid).toBe(true);
  });

  it("句点が行末ならば違反ではありません。", () => {
    const body = `1文目です。
2文目です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("複数の句点が中間にある単一行はfailします。", () => {
    const [valid] = bodyLineBreakPunctuation(buildCommit("1文目。2文目。3文目。"), "always");
    expect(valid).toBe(false);
  });

  it("引用ブロックの中身は対象外です。", () => {
    const body = `引用元の発言:

> 唐突に改行してる
> 句読点なしの文も含む
> 文中に。句点もある

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("インデントされた引用ブロックも対象外です。", () => {
    const body = `引用:

  > 引用文に句読点なし
  > 続く

末尾です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("ATX見出しは対象外です。", () => {
    const body = `# 見出し

本文の最後。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("複数レベルのATX見出しも対象外です。", () => {
    const body = `# 見出し1

## 見出し2

### 見出し3

本文。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("水平線(ハイフン)は対象外です。", () => {
    const body = `区切り前。

---

区切り後。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("水平線(アスタリスク)は対象外です。", () => {
    const body = `区切り前。

***

区切り後。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("水平線(アンダースコア)は対象外です。", () => {
    const body = `区切り前。

___

区切り後。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("チルダのコードフェンスも対象外です。", () => {
    const body = `コード:

~~~
const x = 1
~~~

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("インデントされたバッククオートフェンスも対象外です。", () => {
    const body = `コード:

  \`\`\`
  const x = 1
  \`\`\`

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("4個以上のバッククオートフェンスも対象外です。", () => {
    const body = `コード:

\`\`\`\`
\`\`\`
内側に短いフェンス
\`\`\`
\`\`\`\`

以上です。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("チルダフェンス内のバッククオートはフェンスを閉じません。", () => {
    const body = `~~~
\`\`\`
中身です
\`\`\`
~~~

本文の終わり。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("番号付きリストの`1)`形式も対象外です。", () => {
    const body = `手順:

1) 最初
2) 次
3) 最後`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("setext見出しの`=`下線(h1)は前行とペアで対象外です。", () => {
    const body = `見出し
======

本文の最後。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("setext見出しの`-`下線(h2)は前行とペアで対象外です。", () => {
    const body = `見出し
------

本文の最後。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("複数のsetext見出しが連続しても各ペアで対象外です。", () => {
    const body = `見出し1
======

本文1。

見出し2
------

本文2。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });

  it("body冒頭のsetext見出しも対象外です。", () => {
    const body = `冒頭の見出し
============

本文。`;
    const [valid] = bodyLineBreakPunctuation(buildCommit(body), "always");
    expect(valid).toBe(true);
  });
});
