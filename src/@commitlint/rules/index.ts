import { type RuleConfig, RuleConfigQuality, type Plugin } from "@commitlint/types";
import { breakNeedsPunctuation } from "./break-needs-punctuation";
import { commaNeedsBreak } from "./comma-needs-break";
import { periodNeedsBreak } from "./period-needs-break";
import { referencesActionEnum } from "./references-action-enum";
import { subjectAlnumStop } from "./subject-alnum-stop";

export const plugin = {
  rules: {
    "body-comma-needs-break": commaNeedsBreak,
    "body-period-needs-break": periodNeedsBreak,
    "body-break-needs-punctuation": breakNeedsPunctuation,
    "references-action-enum": referencesActionEnum,
    "subject-alnum-stop": subjectAlnumStop,
  },
} as const satisfies Plugin;

export interface RulesConfig<V = RuleConfigQuality.User> {
  "body-comma-needs-break": RuleConfig<V, undefined>;
  "body-period-needs-break": RuleConfig<V, undefined>;
  "body-break-needs-punctuation": RuleConfig<V, RegExp | undefined>;
  "references-action-enum": RuleConfig<V, readonly string[] | undefined>;
  "subject-alnum-stop": RuleConfig<V, RegExp | undefined>;
}
