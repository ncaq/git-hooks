import { argv } from "node:process";
import { Args, Command as CliCommand } from "@effect/cli";
import type { CommandExecutor } from "@effect/platform";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { deleteMergedBranch, type DeleteMergedBranchFailure } from "../delete-merged-branch";

/**
 * Gitから渡される位置引数を吸収する定義。
 * post-mergeフックは`is_squash_merge`フラグを引数として渡してくるが、
 * 削除処理本体では参照しないため受け取って捨てる。
 */
const forwardedArgs = Args.text({ name: "forwarded-args" }).pipe(Args.repeated);

/** `@effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = (): Effect.Effect<
  void,
  DeleteMergedBranchFailure,
  CommandExecutor.CommandExecutor
> => deleteMergedBranch.pipe(Effect.tapError((err) => Console.error(err.message)));

/** post-mergeフック本体のCLI定義。 */
const command = CliCommand.make("post-merge", { args: forwardedArgs }, handle);

/** `argv`を受け取って起動するCLI実行関数。 */
const cli = CliCommand.run(command, { name: "post-merge", version: "0.0.0" });

NodeRuntime.runMain(cli(argv).pipe(Effect.provide(NodeContext.layer)));
