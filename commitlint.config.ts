import type { RulesConfig, UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";
import { plugin as userPlugin, type RulesConfig as UserRulesConfig } from "./src/@commitlint/rules/index";

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
};

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules,
  plugins: [userPlugin],
};

export default Configuration;
