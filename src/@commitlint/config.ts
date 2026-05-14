import conventionalConfig from "@commitlint/config-conventional";
import type { LintOptions, PluginRecords, QualifiedRules, UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";
import { plugin as userPlugin, type RulesConfig as UserRulesConfig } from "#commitlint-rules";

/**
 * コミットメッセージで許可するissue参照キーワード。
 * 特にcommitlintの標準データでは`"ref"`は含まれていないので明示的に追加する必要があります。
 */
const allowedActions = ["close", "ref"] as const;

/**
 * 明示的に拒否するためにパーサへ認識させるissue参照キーワード。
 * `referenceActions`に登録されない語句はそもそも参照として抽出されず、
 * ルール側で違反検出できないため列挙します。
 */
const rejectedActions = [
  "closed",
  "closes",
  "fix",
  "fixed",
  "fixes",
  "references",
  "refs",
  "resolve",
  "resolved",
  "resolves",
] as const;

/**
 * 個人的に利用するルール。
 * `@commitlint/config-conventional`のルールに重ねがけして最終ルール集合を作る。
 */
const overrideRules = {
  "header-max-length": [RuleConfigSeverity.Error, "always", 72],
  "body-max-line-length": [RuleConfigSeverity.Error, "always", 100],
  "footer-max-line-length": [RuleConfigSeverity.Error, "always", 100],

  "subject-alnum-stop": [RuleConfigSeverity.Error, "never"],

  "subject-case": [RuleConfigSeverity.Disabled],

  "body-line-break-punctuation": [RuleConfigSeverity.Error, "always"],

  "references-action-enum": [RuleConfigSeverity.Error, "always", allowedActions],
} as const satisfies Partial<UserRulesConfig & UserConfig["rules"]>;

export const rules = {
  ...conventionalConfig.rules,
  ...overrideRules,
} as const satisfies QualifiedRules;

/**
 * `conventional-changelog-conventionalcommits`が提供する標準parserOptsを、
 * 動的解決を避けるため値ベースで内蔵する。
 * `!`を伴うbreaking change記法のheaderPatternまで含めて従来挙動に揃える。
 */
const parserOpts = {
  headerPattern: /^(\w*)(?:\((.*)\))?!?: (.*)$/,
  breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  headerCorrespondence: ["type", "scope", "subject"],
  noteKeywords: ["BREAKING CHANGE", "BREAKING-CHANGE"],
  revertPattern: /^(?:Revert|revert:)\s"?([\s\S]+?)"?\s*This reverts commit (\w*)\./i,
  revertCorrespondence: ["header", "hash"],
  issuePrefixes: ["#"],
  referenceActions: [...allowedActions, ...rejectedActions],
} as const satisfies LintOptions["parserOpts"];

const plugins = { local: userPlugin } as const satisfies PluginRecords;

export const lintOptions = { parserOpts, plugins } as const satisfies LintOptions;
