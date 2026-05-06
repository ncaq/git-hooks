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

  // issue参照のアクションキーワードは小文字単数の`close`と`ref`のみ許可。
  "references-action-enum": [RuleConfigSeverity.Error, "always", ["close", "ref"]],
};

const Configuration: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  // パーサがissue参照として抽出する語彙を拡張します。
  // ここに含めない語句は参照として認識されないため`references-action-enum`で検査できません。
  // 正しく拒否するために許可しない語句もここに含める必要があります。
  // 大文字始まりはパーサがcase-insensitive(gi)で照合するためここに含める必要はありません。
  parserPreset: {
    parserOpts: {
      referenceActions: [
        "close",
        "closed",
        "closes",
        "fix",
        "fixed",
        "fixes",
        "ref",
        "references",
        "refs",
        "resolve",
        "resolved",
        "resolves",
      ],
    },
  },
  rules,
  plugins: [userPlugin],
};

export default Configuration;
