import { type RuleConfig, RuleConfigQuality, type Plugin } from "@commitlint/types";
import { referencesActionEnum } from "./references-action-enum";
import { subjectAlnumStop } from "./subject-alnum-stop";

export const plugin = {
  rules: {
    "references-action-enum": referencesActionEnum,
    "subject-alnum-stop": subjectAlnumStop,
  },
} as const satisfies Plugin;

export interface RulesConfig<V = RuleConfigQuality.User> {
  "references-action-enum": RuleConfig<V, readonly string[] | undefined>;
  "subject-alnum-stop": RuleConfig<V, RegExp | undefined>;
}
