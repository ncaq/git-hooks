import { describe, expect, it } from "vitest";
import { buildCommit } from "./build-commit";
import { breakNeedsPunctuation } from "#commitlint-rules/break-needs-punctuation";

describe("breakNeedsPunctuation", () => {
  it("bodyがnullならpassします。", () => {
    const [valid, msg] = breakNeedsPunctuation(buildCommit(null), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("bodyが空文字ならpassします。", () => {
    const [valid, msg] = breakNeedsPunctuation(buildCommit(""), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("単一行で句点で終わるbodyはpassします。", () => {
    const [valid, msg] = breakNeedsPunctuation(buildCommit("単一行で句点で終わる。"), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("単一行で句読点なしのbodyはfailします。", () => {
    const [valid] = breakNeedsPunctuation(buildCommit("単一行で句読点なし"), "always");
    expect(valid).toBe(false);
  });

  it("全ての行が句点で終わる日本語のbodyはpassします。", () => {
    const body = `1行目です。
2行目です。
3行目です。`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("読点で終わって続く行もpassします。", () => {
    const body = `読点で終わって、
次の行に続く。`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("カンマで終わって続く行もpassします。", () => {
    const body = `ends with comma,
next line.`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("疑問符で終わる行はpassします。", () => {
    const body = `本当ですか？
本当です。`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("感嘆符で終わる行はpassします。", () => {
    const body = `Wow!
それは凄い。`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("コロンで終わる行はpassします。", () => {
    const body = `次の通りです:

- 項目`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("セミコロンで終わる行はpassします。", () => {
    const body = `first part;
second part.`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("全角句点で終わる行はpassします。", () => {
    const body = `1行目です．
2行目です．`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("最終行も句読点で終わることが要求されます。", () => {
    const body = `前の行は句点で終わる。
最後の行は句読点なし`;
    const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("句読点なしで唐突に改行する日本語はfailします。", () => {
    const body = `句読点のない
唐突な改行は禁止。`;
    const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("句読点なしで改行する英文はfailします。", () => {
    const body = `no punctuation here
but still continues.`;
    const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("途中の行が句読点で終わらないとfailします。", () => {
    const body = `1行目は句点。
2行目に句読点なし
3行目に続く。`;
    const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  it("空行はそれ自身は対象外です。", () => {
    const body = `段落1の終わり。

段落2の始まり。`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(msg).toBeUndefined();
    expect(valid).toBe(true);
  });

  it("段落最後の行が句読点なしならfailします(空行の前の行)。", () => {
    const body = `段落1は句点なしで終わる

段落2は句点で終わる。`;
    const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
  });

  describe("Markdown構造は対象外", () => {
    it("ハイフンで始まるリスト項目は対象外です。", () => {
      const body = `リスト:

- 項目1
- 項目2
- 項目3`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("アスタリスクで始まるリスト項目は対象外です。", () => {
      const body = `リスト:

* 項目1
* 項目2
* 項目3`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("プラス記号で始まるリスト項目は対象外です。", () => {
      const body = `リスト:

+ 項目1
+ 項目2
+ 項目3`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("番号付きリスト項目は対象外です。", () => {
      const body = `手順:

1. 最初
2. 次
3. 最後`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("番号付きリストの`1)`形式も対象外です。", () => {
      const body = `手順:

1) 最初
2) 次
3) 最後`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("インデントされたリスト項目も対象外です。", () => {
      const body = `ネスト:

- 親項目
  - 子項目1
  - 子項目2`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
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
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("言語指定付きのコードブロック内も対象外です。", () => {
      const body = `コード例:

\`\`\`typescript
const x = 1
const y = 2
\`\`\`

以上です。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("コードブロックの直前の行が句読点なしならfailします。", () => {
      const body = `コード例

\`\`\`
const x = 1
\`\`\`

以上です。`;
      const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(valid).toBe(false);
    });

    it("コードブロックが閉じていないと内部扱いとなり後続も無視されます。", () => {
      const body = `始まり:

\`\`\`
const x = 1
const y = 2`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("チルダのコードフェンスも対象外です。", () => {
      const body = `コード:

~~~
const x = 1
~~~

以上です。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("インデントされたバッククオートフェンスも対象外です。", () => {
      const body = `コード:

  \`\`\`
  const x = 1
  \`\`\`

以上です。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
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
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("チルダフェンス内のバッククオートはフェンスを閉じません。", () => {
      const body = `~~~
\`\`\`
中身です
\`\`\`
~~~

本文の終わり。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("5個のバッククオートフェンスは3個では閉じられず以降が全てコードブロック扱いになります。", () => {
      const body = `コード:

\`\`\`\`\`
const x = 1
\`\`\`
内側に句読点なしの行があっても検出されない
\`\`\`\`\`

末尾です。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("チルダフェンスをバッククオートで閉じようとしても閉じず内部の違反は検出されません。", () => {
      const body = `~~~
const x = 1
\`\`\`
ここは句読点なしでも違反として検出されない
\`\`\`
~~~

本文の終わり。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("4スペース以上インデントしたバッククオートはインデントコードブロックとして対象外です。", () => {
      const body = `コード:

    \`\`\`
    const x = 1
    \`\`\`

末尾。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("引用ブロックの中身は対象外です。", () => {
      const body = `引用元の発言:

> 唐突に改行してる
> 句読点なしの文も含む
> 文中に。句点もある

以上です。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("インデントされた引用ブロックも対象外です。", () => {
      const body = `引用:

  > 引用文に句読点なし
  > 続く

末尾です。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("ATX見出しは対象外です。", () => {
      const body = `# 見出し

本文の最後。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("複数レベルのATX見出しも対象外です。", () => {
      const body = `# 見出し1

## 見出し2

### 見出し3

本文。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("水平線(ハイフン)は対象外です。", () => {
      const body = `区切り前。

---

区切り後。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("水平線(アスタリスク)は対象外です。", () => {
      const body = `区切り前。

***

区切り後。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("水平線(アンダースコア)は対象外です。", () => {
      const body = `区切り前。

___

区切り後。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("setext見出しの`=`下線(h1)は前行とペアで対象外です。", () => {
      const body = `見出し
======

本文の最後。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("setext見出しの`-`下線(h2)は前行とペアで対象外です。", () => {
      const body = `見出し
------

本文の最後。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("複数のsetext見出しが連続しても各ペアで対象外です。", () => {
      const body = `見出し1
======

本文1。

見出し2
------

本文2。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("body冒頭のsetext見出しも対象外です。", () => {
      const body = `冒頭の見出し
============

本文。`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("段落行と下線の間に空行があるとsetext見出しとして扱われず段落行が違反として検査されます。", () => {
      const body = `見出し候補

======

本文。`;
      const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(valid).toBe(false);
    });

    it("リスト項目に続く下線とテキストは遅延継続でリスト項目内に取り込まれ対象外です。", () => {
      const body = `- 項目
======
句読点なしの行`;
      const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("孤立した下線風の行は単なる段落として扱われ句読点なしならfailします。", () => {
      const body = `======

本文。`;
      const [valid] = breakNeedsPunctuation(buildCommit(body), "always");
      expect(valid).toBe(false);
    });
  });

  describe("インラインコード・URL・リンクは行末terminatorとして扱われる", () => {
    it("インラインコードだけの行は許可されます。", () => {
      const [valid, msg] = breakNeedsPunctuation(buildCommit("`foo.bar`"), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("issueへの番号参照(#123)のみの行は許可されます。", () => {
      const [valid, msg] = breakNeedsPunctuation(buildCommit("close #123."), "always");
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("URLを単独で貼り付けてもpassします。", () => {
      const [valid, msg] = breakNeedsPunctuation(
        buildCommit("https://github.com/ncaq/git-hooks/issues/91"),
        "always",
      );
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });

    it("拡張Markdownのオートリンク記法(<URL>)はpassします。", () => {
      const [valid, msg] = breakNeedsPunctuation(
        buildCommit("<https://example.com/foo.html>"),
        "always",
      );
      expect(msg).toBeUndefined();
      expect(valid).toBe(true);
    });
  });

  it("when=always以外は未サポートで例外を投げます。", () => {
    expect(() => breakNeedsPunctuation(buildCommit("ends with period."), "never")).toThrow();
  });

  it("カスタム正規表現で句点のみ許可するとカンマ終わりはfailします。", () => {
    const onlyPeriod = /(?:[.。])$/u;
    const body = `ends with comma,
next line.`;
    const [valid] = breakNeedsPunctuation(buildCommit(body), "always", onlyPeriod);
    expect(valid).toBe(false);
  });

  it("単一違反のメッセージは指定の構造を持ちます。", () => {
    const [valid, msg] = breakNeedsPunctuation(buildCommit("句読点なしの一行"), "always");
    expect(valid).toBe(false);
    expect(msg).toBe("body lines [句読点なしの一行] must end with punctuation");
  });

  it("複数違反は違反行を` / `で結合します。", () => {
    const body = `違反1の行
違反2の行
句点で終わる。`;
    const [valid, msg] = breakNeedsPunctuation(buildCommit(body), "always");
    expect(valid).toBe(false);
    expect(msg).toBe("body lines [違反1の行 / 違反2の行] must end with punctuation");
  });
});
