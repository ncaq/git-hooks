import { argv } from "node:process";
import { Args, Command as CliCommand } from "@effect/cli";
import type { CommandExecutor } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { delegateToGitLfs, type GitLfsHookError } from "../git-lfs";

/**
 * Gitから渡される位置引数を吸収する定義。
 * post-checkoutフックは移動前後のrefとブランチ切り替えフラグを引数として渡してくるので、
 * そのままgit-lfsへ転送する。
 */
const forwardedArgs = Args.text({ name: "forwarded-args" }).pipe(Args.repeated);

/** `@effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = ({
  args,
}: {
  readonly args: readonly string[];
}): Effect.Effect<void, GitLfsHookError, CommandExecutor.CommandExecutor> =>
  delegateToGitLfs("post-checkout", args).pipe(
    Effect.tapError((err) => Console.error(err.message)),
  );

/** post-checkoutフック本体のCLI定義。 */
const command = CliCommand.make("post-checkout", { args: forwardedArgs }, handle);

/** `argv`を受け取って起動するCLI実行関数。 */
const cli = CliCommand.run(command, { name: "post-checkout", version: "0.0.0" });

NodeRuntime.runMain(cli(argv).pipe(Effect.provide(NodeContext.layer)));
