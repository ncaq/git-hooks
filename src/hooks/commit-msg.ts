import { argv, stderr } from "node:process";
import format from "@commitlint/format";
import lintFn from "@commitlint/lint";
import { Args, Command } from "@effect/cli";
import { FileSystem } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Data, Effect, Match } from "effect";
import { lintOptions, rules } from "#commitlint/config";

/** ユーザーへ表示すべきメッセージ付きで失敗する場合のエラー。 */
class CommitMsgFailure extends Data.TaggedError("CommitMsgFailure")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** lint結果のerror件数が0より多いことを示す。整形出力済みなので追加のメッセージは持たない。 */
class LintReportedErrors extends Data.TaggedError("LintReportedErrors") {}

/** lintの戻り値型。直接利用できる型エクスポートが無いため`Awaited`で取り出す。 */
type LintOutcome = Awaited<ReturnType<typeof lintFn>>;

/** コミットメッセージファイルへのパスを表す位置引数。存在検証は`@effect/cli`に委ねる。 */
const editmsgFileArg = Args.file({ name: "commit-msg-file", exists: "yes" });

/** commitlintを呼び出し、構造化したエラーで投げ直す。 */
const runLint = (message: string): Effect.Effect<LintOutcome, CommitMsgFailure> =>
  Effect.tryPromise({
    try: () => lintFn(message, rules, lintOptions),
    catch: (cause) =>
      new CommitMsgFailure({
        message: `${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      }),
  });

/**
 * lint結果に違反があれば整形して標準エラー出力へ書く。
 * errorが1件以上あれば`LintReportedErrors`で失敗する。
 */
const reportOutcome = (outcome: LintOutcome): Effect.Effect<void, LintReportedErrors> =>
  Effect.sync(() => 0 < outcome.errors.length || 0 < outcome.warnings.length).pipe(
    Effect.tap((hasIssue) =>
      hasIssue
        ? Effect.sync(() => stderr.write(`${format({ results: [outcome] })}\n`))
        : Effect.void,
    ),
    Effect.flatMap(() => (0 < outcome.errors.length ? new LintReportedErrors() : Effect.void)),
  );

/** `@effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = ({
  file,
}: {
  readonly file: string;
}): Effect.Effect<void, CommitMsgFailure | LintReportedErrors, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const message = yield* fs
      .readFileString(file, "utf8")
      .pipe(
        Effect.mapError((cause) => new CommitMsgFailure({ message: `${cause.message}`, cause })),
      );
    const outcome = yield* runLint(message);
    yield* reportOutcome(outcome);
  }).pipe(
    Effect.tapError(
      Match.typeTags<CommitMsgFailure | LintReportedErrors>()({
        CommitMsgFailure: (err) => Console.error(err.message),
        LintReportedErrors: () => Effect.void,
      }),
    ),
  );

/** commit-msgフック本体のCLI定義。 */
const command = Command.make("commit-msg", { file: editmsgFileArg }, handle);

/** `argv`を受け取って起動するCLI実行関数。 */
const cli = Command.run(command, { name: "commit-msg", version: "0.0.0" });

NodeRuntime.runMain(cli(argv).pipe(Effect.provide(NodeContext.layer)));
