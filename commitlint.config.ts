import type { RulesConfig, UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";
import { plugin as userPlugin, type RulesConfig as UserRulesConfig } from "./src/@commitlint/rules/index";

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

const rules: Partial<RulesConfig & UserRulesConfig> = {
  // ヘッダの幅は72文字まで。Git公式推奨の50文字は厳しすぎるので緩和。
  "header-max-length": [RuleConfigSeverity.Error, "always", 72],
  // ボディの1行幅は100文字まで。Git公式推奨の72文字は現代のターミナルの幅では合理的ではないです。
  "body-max-line-length": [RuleConfigSeverity.Error, "always", 100],
  // フッタの1行幅は100文字まで。Git公式推奨の72文字は現代のターミナルの幅では合理的ではないです。
  "footer-max-line-length": [RuleConfigSeverity.Error, "always", 100],

  // タイトルは日本語を含めたUnicode可読文字で終わることを求めます。
  "subject-alnum-stop": [RuleConfigSeverity.Error, "never"],

  // 関数などの識別子などを直接コミットメッセージのタイトルに書きたいのでcase識別は無効にします。
  "subject-case": [RuleConfigSeverity.Disabled],

  // issue参照のアクションキーワードは小文字単数の`close`と`ref`のみ許可。
  "references-action-enum": [RuleConfigSeverity.Error, "always", allowedActions],
};

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  parserPreset: {
    parserOpts: {
      // パーサがissue参照キーワードとして抽出する語彙を拡張します。
      // ここに含めない語句は参照として認識されないため`references-action-enum`で検査できません。
      // 大文字始まりはパーサがcase-insensitive(gi)で照合するため別途追加する必要はありません。
      referenceActions: [...allowedActions, ...rejectedActions],
    },
  },
  rules,
  plugins: [userPlugin],
};

export default Configuration;
