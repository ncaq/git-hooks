import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import type { Paragraph, PhrasingContent, Root } from "mdast";
import { fromMarkdown, type Options as FromMarkdownOptions } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import * as P from "parser-ts/Parser";
import { stream, type Stream } from "parser-ts/Stream";
import * as C from "parser-ts/char";

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
const commaPrefixThreshold = 6 as const;

const punctuationChars = ".。．,，、" as const;
const commaChars = ",，、" as const;

/**
 * 行末として許容する終端文字のデフォルト集合。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
const defaultTerminator = /[\p{P}`]/u;

/** 与えられた終端文字の正規表現を、行末アンカー付きの正規表現に変換する。 */
function anchorAtEnd(terminator: RegExp): RegExp {
  return new RegExp(`(?:${terminator.source})$`, "u");
}

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
function extractLines(body: string): readonly string[] {
  const tree: Root = fromMarkdown(body, fromMarkdownOptions);
  return tree.children.flatMap((child) => (child.type === "paragraph" ? paragraphToLines(child) : []));
}

/**
 * 句読点ではない文字を1文字以上連続で消費し、消費した文字列を返す。
 * 1ステップで可能な限り長くマッチさせるため、1文字単位ではなく文字列単位の処理になる。
 */
const safeRun: P.Parser<C.Char, string> = C.many1(C.notOneOf(punctuationChars));

/**
 * 短い前置きの後の読点(1文字)を消費する。
 * 開始位置が`commaPrefixThreshold`未満のときのみ成功する。
 */
const earlyComma: P.Parser<C.Char, string> = pipe(
  P.withStart(C.oneOf(commaChars)),
  P.filter(([, start]: [string, Stream<C.Char>]) => start.cursor < commaPrefixThreshold),
  P.map(([s]) => s),
);

/**
 * 中間として消費可能な1ステップ。
 * 必ず1文字以上消費するので、`many`しても無限ループにならない。
 */
const midStep: P.Parser<C.Char, string> = P.either(safeRun, () => earlyComma);

/**
 * 「中間句読点なし」の行を読み切るパーサ。
 * 中間ステップを0回以上消費した後、最終1文字を任意に消費して終わる(空行も許容)。
 */
const noMidLinePunctuation: P.Parser<C.Char, void> = pipe(
  P.many(midStep),
  P.chain(() =>
    P.either(
      pipe(
        P.eof<C.Char>(),
        P.map<void, void>(() => undefined),
      ),
      () =>
        pipe(
          P.item<C.Char>(),
          P.chainFirst(() => P.eof<C.Char>()),
          P.map<C.Char, void>(() => undefined),
        ),
    ),
  ),
);

/** 行に中間句読点が無いかを判定する。 */
function hasNoMidLinePunctuation(line: string): boolean {
  return isRight(noMidLinePunctuation(stream(Array.from(line))));
}

/** 個別の行が違反であるかを判定する。 */
function isLineViolation(line: string, anchoredTerminator: RegExp, negated: boolean): boolean {
  const endsWithTerminator = anchoredTerminator.test(line);
  if (negated) {
    return endsWithTerminator;
  }
  return !endsWithTerminator || !hasNoMidLinePunctuation(line);
}

/**
 * ルール本体。
 *
 * コミットメッセージ`body`の唐突な改行を抑制するルール。
 *
 * `when="always"`: 各行は以下の条件を全て満たす必要がある。
 * - 行末が`value`の終端文字で終わる
 * - 行の途中に句点(`.`/`。`/`．`)が無い
 * - 行の途中の読点(`,`/`，`/`、`)は前置文字数が閾値未満のときのみ許容する
 *
 * 検査対象はmdast上の段落(`paragraph`ノード)に限られる。
 * 空行・リスト項目・コードフェンス内・引用ブロック・見出し(ATX/setext)・水平線・テーブルは段落として扱われないため対象外。
 * リスト項目直後の行は遅延継続でリスト項目内に取り込まれるため対象外となる。
 * 段落内の`inlineCode`(バッククオート囲み)の中身も中間句読点判定の対象外となる。
 *
 * `when="never"`: 行末が`value`の終端文字で終わる行を違反とする。
 * neverモードの実用性が全く分からないので、
 * 一応慣習に従って実装はしますが、
 * 真面目に検査していません。
 */
export const bodyLineBreakPunctuation: SyncRule<RegExp> = (parsed, when = "always", value = defaultTerminator) => {
  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const negated = when === "never";
  const anchoredTerminator = anchorAtEnd(value);

  const violations = extractLines(body).filter((line) => isLineViolation(line, anchoredTerminator, negated));

  if (violations.length === 0) {
    return [true];
  }

  const verb = negated ? "must not" : "must";
  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, verb, "end with punctuation and break after sentences"]),
  ];
};
