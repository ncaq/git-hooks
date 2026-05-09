import type { Paragraph, PhrasingContent, Root } from "mdast";
import { fromMarkdown, type Options as FromMarkdownOptions } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

/**
 * コミットメッセージで受け付けるマークダウンの設定。
 * `readonly`を受け付けないので`as const`は使えない。
 */
const fromMarkdownOptions: FromMarkdownOptions = { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] };

/**
 * `inlineCode`の中身は中間句読点判定の対象外なので、
 * 段落をテキスト化するときに無害な英字列に置換する。
 * 外側のバッククオートはそのまま残し、行末terminatorとしての扱いを維持する。
 */
function inlineCodeToText(value: string): string {
  return `\`${"x".repeat(value.length)}\``;
}

/**
 * `paragraph`配下の`PhrasingContent`を文字列として再構築する。
 * `inlineCode`はマスクし、`break`は改行に、入れ子(`emphasis`等)は子要素を再帰的に展開する。
 */
function phrasingToText(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
      return node.value;
    case "inlineCode":
      return inlineCodeToText(node.value);
    case "break":
      return "\n";
    default:
      return "children" in node ? node.children.map(phrasingToText).join("") : "";
  }
}

/**
 * `paragraph`をsoftbreak/hardbreakで分割した行の配列に変換する。
 * mdastの段落内では`text`ノード中の`\n`がsoftbreakを表すため、
 * `phrasingToText`で連結した結果を`\n`で分割すれば論理行が得られる。
 */
function paragraphToLines(paragraph: Paragraph): readonly string[] {
  return paragraph.children.map(phrasingToText).join("").split("\n");
}

/**
 * bodyから検査対象となる段落の各行を、出現順に抽出する。
 * bodyをMarkdown(GFM拡張込み)としてパースし、ルート直下の`paragraph`のみを対象とする。
 * リスト・引用・コードブロック・見出し(ATX/setext)・水平線・テーブルなどは
 * `paragraph`にならず自然に除外される。
 * リスト項目や引用ブロック内部にネストする段落も、ルート直下ではないので対象外。
 */
export function extractLines(body: string): readonly string[] {
  const tree: Root = fromMarkdown(body, fromMarkdownOptions);
  return tree.children.flatMap((child) => (child.type === "paragraph" ? paragraphToLines(child) : []));
}
