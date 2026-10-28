import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command as CliCommand } from "effect/cli";
import type { ChildProcessSpawner } from "effect/process";
import { delegateToGitLfs, type GitLfsHookError } from "../git-lfs";

/**
 * Gitから渡される位置引数を吸収する定義。
 * post-checkoutフックは移動前後のrefとブランチ切り替えフラグを引数として渡してくるので、
 * そのままgit-lfsへ転送する。
 */
const forwardedArgs = Argument.String("forwarded-args").pipe(Argument.variadic());

/** `effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = ({
  args,
}: {
  readonly args: readonly string[];
}): Effect.Effect<void, GitLfsHookError, ChildProcessSpawner.ChildProcessSpawner> =>
  delegateToGitLfs("post-checkout", args).pipe(
    Effect.tapError((err) => Console.error(err.message)),
  );

/** post-checkoutフック本体のCLI定義。 */
const command = CliCommand.make("post-checkout", { args: forwardedArgs }, handle);

/**
 * CLIを起動する。
 * コマンドライン引数は`Stdio`サービス経由で`process.argv`から取得される。
 */
CliCommand.run(command, { version: "0.0.0" }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
