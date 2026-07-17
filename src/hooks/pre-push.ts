import { argv } from "node:process";
import { Args, Command as CliCommand } from "@effect/cli";
import type { CommandExecutor } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { delegateToGitLfs, type GitLfsHookError } from "../git-lfs";

/**
 * Gitから渡される位置引数を吸収する定義。
 * pre-pushフックはリモート名とURLを引数として渡してくるので、
 * そのままgit-lfsへ転送する。
 */
const forwardedArgs = Args.text({ name: "forwarded-args" }).pipe(Args.repeated);

/** `@effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = ({
  args,
}: {
  readonly args: readonly string[];
}): Effect.Effect<void, GitLfsHookError, CommandExecutor.CommandExecutor> =>
  delegateToGitLfs("pre-push", args).pipe(Effect.tapError((err) => Console.error(err.message)));

/** pre-pushフック本体のCLI定義。 */
const command = CliCommand.make("pre-push", { args: forwardedArgs }, handle);

/** `argv`を受け取って起動するCLI実行関数。 */
const cli = CliCommand.run(command, { name: "pre-push", version: "0.0.0" });

NodeRuntime.runMain(cli(argv).pipe(Effect.provide(NodeContext.layer)));
