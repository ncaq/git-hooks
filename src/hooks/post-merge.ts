import { argv } from "node:process";
import { Args, Command as CliCommand } from "@effect/cli";
import { Command, CommandExecutor, Path } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Data, Effect } from "effect";

/** post-mergeフックで発生し得るエラー。 */
class PostMergeFailure extends Data.TaggedError("PostMergeFailure")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/** Gitから渡される任意個数の位置引数を受け取り、そのままシェルスクリプトへ転送する。 */
const forwardedArgs = Args.text({ name: "forwarded-args" }).pipe(Args.repeated);

/**
 * 自身の配置からプロジェクトルートを辿り、
 * bashスクリプトの位置を解決します。
 * `dist/hooks/post-merge`から見て、
 * `script/delete-merged-branch`は二つ上の階層にあります。
 */
const resolveScriptPath: Effect.Effect<string, PostMergeFailure, Path.Path> = Effect.gen(
  function* () {
    const path = yield* Path.Path;
    const here = yield* path.fromFileUrl(new URL(import.meta.url)).pipe(
      Effect.mapError(
        (cause) =>
          new PostMergeFailure({
            message: `failed to resolve module path: ${cause.message}`,
            cause,
          }),
      ),
    );
    return path.resolve(path.dirname(here), "..", "..", "script", "delete-merged-branch");
  },
);

/** `@effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = ({
  args,
}: {
  readonly args: readonly string[];
}): Effect.Effect<void, PostMergeFailure, Path.Path | CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const scriptPath = yield* resolveScriptPath;
    const child = Command.make(scriptPath, ...args).pipe(
      Command.stdin("inherit"),
      Command.stdout("inherit"),
      Command.stderr("inherit"),
    );
    const code = yield* Command.exitCode(child).pipe(
      Effect.mapError(
        (cause) =>
          new PostMergeFailure({
            message: `failed to execute ${scriptPath}: ${cause.message}`,
            cause,
          }),
      ),
    );
    if (code !== 0) {
      return yield* new PostMergeFailure({
        message: `${scriptPath} exited with code ${code}`,
      });
    }
  }).pipe(Effect.tapError((err) => Console.error(err.message)));

/** post-mergeフック本体のCLI定義。 */
const command = CliCommand.make("post-merge", { args: forwardedArgs }, handle);

/** `argv`を受け取って起動するCLI実行関数。 */
const cli = CliCommand.run(command, { name: "post-merge", version: "0.0.0" });

NodeRuntime.runMain(cli(argv).pipe(Effect.provide(NodeContext.layer)));
