import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect } from "effect";
import { Argument, Command as CliCommand } from "effect/cli";
import type { ChildProcessSpawner } from "effect/process";
import { deleteMergedBranch, type DeleteMergedBranchError } from "../delete-merged-branch";
import { delegateToGitLfs, type GitLfsHookError } from "../git-lfs";

/**
 * Gitから渡される位置引数を吸収する定義。
 * post-mergeフックは`is_squash_merge`フラグを引数として渡してくる。
 * git-lfsへの委譲ではそのまま転送し、削除処理本体では参照しない。
 */
const forwardedArgs = Argument.String("forwarded-args").pipe(Argument.variadic());

/** `effect/cli`の引数パース後に呼ばれるハンドラ本体。 */
const handle = ({
  args,
}: {
  readonly args: readonly string[];
}): Effect.Effect<
  void,
  DeleteMergedBranchError | GitLfsHookError,
  ChildProcessSpawner.ChildProcessSpawner
> =>
  delegateToGitLfs("post-merge", args).pipe(
    Effect.andThen(deleteMergedBranch),
    Effect.tapError((err) => Console.error(err.message)),
  );

/** post-mergeフック本体のCLI定義。 */
const command = CliCommand.make("post-merge", { args: forwardedArgs }, handle);

/**
 * CLIを起動する。
 * コマンドライン引数は`Stdio`サービス経由で`process.argv`から取得される。
 */
CliCommand.run(command, { version: "0.0.0" }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
