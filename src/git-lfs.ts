import { Command, CommandExecutor, Error as PlatformError } from "@effect/platform";
import { Data, Effect } from "effect";

/**
 * `git lfs`サブコマンドの起動・実行自体が`PlatformError`で失敗した場合のエラー。
 * `cause`に元の`PlatformError`を保持し、`args`に実行しようとした引数列を構造化して持つ。
 */
export class GitLfsCommandFailure extends Data.TaggedError("GitLfsCommandFailure")<{
  readonly args: readonly string[];
  readonly cause: PlatformError.PlatformError;
}> {
  override get message(): string {
    return `git ${this.args.join(" ")}: ${this.cause.message}`;
  }
}

/**
 * `git lfs`サブコマンドが起動はしたが非0で終了した場合のエラー。
 * git-lfs自身が詳細を標準エラー出力へ書くため、ここでは引数列と終了コードだけを持つ。
 */
export class GitLfsNonZeroExit extends Data.TaggedError("GitLfsNonZeroExit")<{
  readonly args: readonly string[];
  readonly exitCode: number;
}> {
  override get message(): string {
    return `git ${this.args.join(" ")} exited with code ${this.exitCode}`;
  }
}

/** このモジュールが返し得るエラーの全集合。 */
export type GitLfsHookError = GitLfsCommandFailure | GitLfsNonZeroExit;

/** git-lfsが`git lfs install`で`.git/hooks`へ設置するhookの名前。 */
export type GitLfsHookName = "post-checkout" | "post-commit" | "post-merge" | "pre-push";

/**
 * Gitから渡されたhook引数をそのまま`git lfs <hook>`へ委譲する。
 *
 * `core.hooksPath`で共通hooksを固定すると、
 * git-lfsが`.git/hooks`へ設置するhookは実行されなくなる。
 * そのため共通hooks側からgit-lfsの同名hookを呼び出してLFSの動作を維持する。
 *
 * pre-pushはpush対象のref一覧を標準入力から受け取るため、
 * 標準入出力はすべて親プロセスから継承する。
 * LFSを使っていないリポジトリではgit-lfsが即座に何もせず正常終了するので、
 * リポジトリごとの分岐は不要。
 */
export const delegateToGitLfs = (
  hook: GitLfsHookName,
  forwarded: readonly string[],
): Effect.Effect<void, GitLfsHookError, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const args = ["lfs", hook, ...forwarded];
    const cmd = Command.make("git", ...args).pipe(
      Command.stdin("inherit"),
      Command.stdout("inherit"),
      Command.stderr("inherit"),
    );
    const code = yield* Command.exitCode(cmd).pipe(
      Effect.mapError((cause) => new GitLfsCommandFailure({ args, cause })),
    );
    if (code !== 0) {
      return yield* new GitLfsNonZeroExit({ args, exitCode: code });
    }
  });
