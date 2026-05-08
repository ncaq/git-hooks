import message from "@commitlint/message";
import type { SyncRule } from "@commitlint/types";
import { isRight } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as P from "parser-ts/Parser";
import { stream, type Stream } from "parser-ts/Stream";
import { type Char, default as C } from "parser-ts/char";

/**
 * 読点を改行強制対象から外す前置文字数の閾値。
 * 数文字程度の接続詞(`また、`等)は途中の読点でも改行を求めない。
 */
const commaPrefixThreshold = 5 as const;

const periodChars = ".。．" as const;
const commaChars = ",，、" as const;

const isPeriod = (c: Char): boolean => periodChars.includes(c);
const isComma = (c: Char): boolean => commaChars.includes(c);

/**
 * 行末として許容する終端文字のデフォルト集合。
 * UnicodeのPunctuationプロパティをベースとし、
 * 加えてインラインコード記法のためにバッククオートを許可する。
 */
const defaultTerminator = /[\p{P}`]/u;

/** Markdownのリスト項目を判定する。インデントされたネストリストにも対応する。 */
const listPattern = /^\s*([-*+]|\d+[.)])\s/u;

/** Markdownの引用ブロックを判定する。引用部分は検査対象外とする。 */
const quotePattern = /^\s*>/u;

/** ATX見出し: `#`から`######`までの後にスペースまたは行末。 */
const headingPattern = /^\s{0,3}#{1,6}(?:\s|$)/u;

/** 水平線: `-`,`*`,`_` のいずれか同一文字が3回以上。 */
const horizontalRulePattern = /^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/u;

/**
 * setext見出しの下線。`=`もしくは`-`が並ぶ単独行で、前行を見出しに昇格させる。
 * `---`は水平線パターンとも重なるが、いずれにせよ下線行自体は対象外なので問題ない。
 */
const setextUnderlinePattern = /^\s{0,3}(?:=+|-+)\s*$/u;

/**
 * 検査対象外の単独行(空行・リスト項目・引用ブロック・見出し・水平線・setext下線)を判定する。
 *
 * Markdownのバリエーションを完全網羅する意図はなく、
 * コミットメッセージで遭遇しがちな代表的な構文に絞って対象外化する。
 * setext見出しの段落行は単独行では判定できず、文法レベルで`setextHeadingBlock`がペアを認識する。
 */
function isExemptLine(line: string): boolean {
  return (
    line === "" ||
    listPattern.test(line) ||
    quotePattern.test(line) ||
    headingPattern.test(line) ||
    horizontalRulePattern.test(line) ||
    setextUnderlinePattern.test(line)
  );
}

/** 与えられた終端文字の正規表現を、行末アンカー付きの正規表現に変換する。 */
function anchorAtEnd(terminator: RegExp): RegExp {
  return new RegExp(`(?:${terminator.source})$`, "u");
}

// ---- 共通の補助パーサ ---------------------------------------------------

/** 行末(改行 or 入力終端)。 */
const lineEnd: P.Parser<Char, void> = P.either(
  pipe(
    C.char("\n"),
    P.map<Char, void>(() => undefined),
  ),
  () => P.eof<Char>(),
);

/** 1行(改行を含めて消費し、改行を除いた文字列を返す)。 */
const anyLine: P.Parser<Char, string> = pipe(C.many(C.notChar("\n")), P.apFirst(lineEnd));

// ---- 1行内の中間句読点判定パーサ ---------------------------------------
//
// 行を1ストリームとみなして、最後の文字を残しつつ前方の文字を「中間として安全な文字」として消費する。
// 安全とは「句点ではなく、かつ位置が`commaPrefixThreshold`未満であるか読点でない」こと。

/** 残り2文字以上あることを先読みで確認する(消費はしない)。 */
const hasNextChar: P.Parser<Char, void> = P.lookAhead(
  pipe(
    P.item<Char>(),
    P.chain(() => P.item<Char>()),
    P.map<Char, void>(() => undefined),
  ),
);

/**
 * 中間として安全な1文字を消費する。
 *
 * - 残り1文字以下のときは「最終文字」とみなしてここでは消費しない。
 * - 句点であれば中間禁止なので失敗。
 * - 読点で位置が`commaPrefixThreshold`以上なら中間禁止なので失敗。
 */
const midLineSafeChar: P.Parser<Char, Char> = pipe(
  hasNextChar,
  P.chain(() =>
    pipe(
      P.withStart(P.item<Char>()),
      P.filter(([ch, start]: [Char, Stream<Char>]) => {
        if (isPeriod(ch)) return false;
        if (isComma(ch) && start.cursor >= commaPrefixThreshold) return false;
        return true;
      }),
      P.map(([ch]) => ch),
    ),
  ),
);

/**
 * 行を「中間禁止文字なし」として読み切るパーサ。
 *
 * 中間文字を可能な限り消費した後、最終1文字を任意の文字として消費する(空行は許容)。
 */
const noMidLinePunctuation: P.Parser<Char, void> = pipe(
  P.many(midLineSafeChar),
  P.chain(() =>
    P.either(
      pipe(
        P.eof<Char>(),
        P.map<void, void>(() => undefined),
      ),
      () =>
        pipe(
          P.item<Char>(),
          P.chainFirst(() => P.eof<Char>()),
          P.map<Char, void>(() => undefined),
        ),
    ),
  ),
);

/** 行に中間句読点が無いかを判定する。 */
function hasNoMidLinePunctuation(line: string): boolean {
  const result = noMidLinePunctuation(stream(Array.from(line)));
  return isRight(result);
}

/**
 * 個別の行が違反であるかを判定する。
 *
 * `negated`が真のとき終端の有無のみで判定し、偽のときは中間句読点も併せて判定する。
 */
function isLineViolation(line: string, anchoredTerminator: RegExp, negated: boolean): boolean {
  const endsWithTerminator = anchoredTerminator.test(line);
  if (negated) {
    return endsWithTerminator;
  }
  return !endsWithTerminator || !hasNoMidLinePunctuation(line);
}

// ---- body 全体の文法 ----------------------------------------------------
//
// body              := block*
// block             := codeBlockBlock | setextHeadingBlock | exemptLineBlock | contentLineBlock
// codeBlockBlock    := fenceLine anyLine* (fenceClose(opener) | EOF)
// setextHeadingBlock:= paragraphLine setextUnderline
// exemptLineBlock   := <isExemptLineにマッチする1行>
// contentLineBlock  := anyLine
// paragraphLine     := <isExemptLineにマッチしない1行>
// setextUnderline   := <setextUnderlinePatternにマッチする1行>
// fenceLine         := <fenceMatcherにマッチする1行>
//
// alternativeで上から順に試し、各ブロックは違反行のリストを返す。
// codeBlock・setextHeading・exemptLineは検査対象外なので空配列を返し、
// contentLineBlockのみが行末や中間句読点を検査して違反を抽出する。

type FenceKind = "backtick" | "tilde";

interface FenceInfo {
  readonly kind: FenceKind;
  readonly length: number;
}

const fenceMatcher = /^\s{0,3}(`{3,}|~{3,})/u;

/** 各ブロックパーサが返す違反行のリスト。 */
type BlockResult = readonly string[];

/**
 * 1行先読みしてフェンス行か判定し、フェンスであればその種類と長さを返しつつ実際に1行消費する。
 *
 * `P.lookAhead`が消費を巻き戻すので、フェンスでない場合はカーソルが進まないまま失敗できる。
 */
const fenceLine: P.Parser<Char, FenceInfo> = pipe(
  P.lookAhead(anyLine),
  P.chain((line) => {
    const matched = fenceMatcher.exec(line);
    if (matched == null) {
      return P.fail<Char, FenceInfo>();
    }
    const marker = matched[1] ?? "";
    const info: FenceInfo = {
      kind: marker.startsWith("`") ? "backtick" : "tilde",
      length: marker.length,
    };
    return pipe(
      anyLine,
      P.map((): FenceInfo => info),
    );
  }),
);

/**
 * コードブロックの終端(同じ種類かつ開始以上の長さを持つ閉じフェンス、または入力終端)。
 *
 * CommonMarkに合わせて、4個で開いたフェンスを3個で閉じることはできない。
 */
const fenceCloseOrEof = (opener: FenceInfo): P.Parser<Char, void> =>
  P.either(
    pipe(
      fenceLine,
      P.filter((closer: FenceInfo) => closer.kind === opener.kind && closer.length >= opener.length),
      P.map<FenceInfo, void>(() => undefined),
    ),
    () => P.eof<Char>(),
  );

/** コードブロック1個。中身は検査対象外なので、空配列を返す。 */
const codeBlockBlock: P.Parser<Char, BlockResult> = pipe(
  fenceLine,
  P.chain((opener) =>
    pipe(
      P.manyTill(anyLine, fenceCloseOrEof(opener)),
      P.map((): BlockResult => []),
    ),
  ),
);

/**
 * setext見出しの2行ペア。
 *
 * 1行目が「単独行としては検査対象になる行」(=isExemptLineにマッチしない)、
 * 2行目が`setextUnderlinePattern`にマッチする場合のみマッチする。
 * いずれかの条件が崩れた場合は`P.either`の効果により入力位置がロールバックされる。
 */
const setextHeadingBlock: P.Parser<Char, BlockResult> = pipe(
  P.lookAhead(anyLine),
  P.filter((line: string) => !isExemptLine(line)),
  P.chain(() => anyLine),
  P.chain(() =>
    pipe(
      P.lookAhead(anyLine),
      P.filter((line: string) => setextUnderlinePattern.test(line)),
      P.chain(() => anyLine),
      P.map((): BlockResult => []),
    ),
  ),
);

/** 単独行で対象外と判定できる1行を消費するブロック。 */
const exemptLineBlock: P.Parser<Char, BlockResult> = pipe(
  P.lookAhead(anyLine),
  P.filter((line: string) => isExemptLine(line)),
  P.chain(() => anyLine),
  P.map((): BlockResult => []),
);

/** 検査対象になる通常の行。違反であればその行を、そうでなければ空配列を返す。 */
const contentLineBlock = (anchoredTerminator: RegExp, negated: boolean): P.Parser<Char, BlockResult> =>
  pipe(
    anyLine,
    P.map((line): BlockResult => (isLineViolation(line, anchoredTerminator, negated) ? [line] : [])),
  );

/**
 * 1ブロック分のパーサ。
 *
 * 入力終端では`P.lookAhead(P.item)`が失敗するので、`P.many`の無限ループを防げる。
 */
const block = (anchoredTerminator: RegExp, negated: boolean): P.Parser<Char, BlockResult> =>
  pipe(
    P.lookAhead(P.item<Char>()),
    P.chain(() =>
      pipe(
        codeBlockBlock,
        P.alt(() => setextHeadingBlock),
        P.alt(() => exemptLineBlock),
        P.alt(() => contentLineBlock(anchoredTerminator, negated)),
      ),
    ),
  );

/** body全体を消費して違反行のリストを返すパーサ。 */
const bodyParser = (anchoredTerminator: RegExp, negated: boolean): P.Parser<Char, BlockResult> =>
  pipe(
    P.many(block(anchoredTerminator, negated)),
    P.map((blocks) => blocks.flat()),
  );

// ---- ルール本体 ----------------------------------------------------------

/**
 * コミットメッセージ`body`の唐突な改行を抑制するルール。
 *
 * `when="always"`: 各行は以下の条件を全て満たす必要がある。
 * - 行末が`value`の終端文字で終わる
 * - 行の途中に句点(`.`/`。`/`．`)が無い
 * - 行の途中の読点(`,`/`，`/`、`)は前置文字数が閾値以下のときのみ許容する
 *
 * 空行・リスト項目(`-`/`*`/`+`/番号付き)・コードフェンス内・引用ブロック・
 * ATX見出し・水平線・setext見出し(段落行+下線のペア)は対象外。
 *
 * `when="never"`: 行末が`value`の終端文字で終わる行を違反とする。
 */
export const bodyLineBreakPunctuation: SyncRule<RegExp> = (parsed, when = "always", value = defaultTerminator) => {
  const body = parsed.body;
  if (body == null || body === "") {
    return [true];
  }

  const negated = when === "never";
  const anchoredTerminator = anchorAtEnd(value);

  const result = bodyParser(anchoredTerminator, negated)(stream(Array.from(body)));
  const violations: readonly string[] = isRight(result) ? result.right.value : [];

  if (violations.length === 0) {
    return [true];
  }

  const verb = negated ? "must not" : "must";
  return [
    false,
    message([`body lines [${violations.join(" / ")}]`, verb, "end with punctuation and break after sentences"]),
  ];
};
