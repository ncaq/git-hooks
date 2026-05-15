import { Command, CommandExecutor, Error as PlatformError } from "@effect/platform";
import { Data, Effect } from "effect";

/**
 * `git`サブコマンドの起動・実行自体が`PlatformError`で失敗した場合のエラー。
 * `cause`に元の`PlatformError`を保持し、`args`に実行しようとした引数列を構造化して持つ。
 */
export class GitCommandFailure extends Data.TaggedError("GitCommandFailure")<{
  readonly args: readonly string[];
  readonly cause: PlatformError.PlatformError;
}> {
  override get message(): string {
    return `git ${this.args.join(" ")}: ${this.cause.message}`;
  }
}

/**
 * `git`サブコマンドが起動はしたが非0で終了した場合のエラー。
 * `args`と`exitCode`を構造化して保持し、表示は`message`で動的に組み立てる。
 */
export class GitNonZeroExit extends Data.TaggedError("GitNonZeroExit")<{
  readonly args: readonly string[];
  readonly exitCode: number;
}> {
  override get message(): string {
    return `git ${this.args.join(" ")} exited with code ${this.exitCode}`;
  }
}

/**
 * `git ls-remote --symref origin HEAD`の出力からデフォルトブランチを抽出できなかった場合のエラー。
 */
export class LsRemoteParseFailure extends Data.TaggedError("LsRemoteParseFailure")<{
  readonly output: string;
}> {
  override get message(): string {
    return `failed to parse default branch from ls-remote output: ${this.output}`;
  }
}

/** このモジュールが返し得るエラーの全集合。 */
export type DeleteMergedBranchError = GitCommandFailure | GitNonZeroExit | LsRemoteParseFailure;

/** `git`サブコマンド呼び出しを生成する小さなヘルパ。 */
function git(...args: readonly string[]): Command.Command {
  return Command.make("git", ...args);
}

/** `PlatformError`を`GitCommandFailure`に包み直す`Effect.mapError`用ヘルパ。 */
const toGitCommandFailure =
  (args: readonly string[]) =>
  (cause: PlatformError.PlatformError): GitCommandFailure =>
    new GitCommandFailure({ args, cause });

/** stdoutを文字列として取得する`git`呼び出し。 */
const gitText = (
  ...args: readonly string[]
): Effect.Effect<string, GitCommandFailure, CommandExecutor.CommandExecutor> =>
  Command.string(git(...args)).pipe(Effect.mapError(toGitCommandFailure(args)));

/** stdout/stderrを継承する`git`呼び出し。終了コードが非0なら`GitNonZeroExit`で失敗にする。 */
const gitInherit = (
  ...args: readonly string[]
): Effect.Effect<void, GitCommandFailure | GitNonZeroExit, CommandExecutor.CommandExecutor> =>
  Effect.gen(function* () {
    const cmd = git(...args).pipe(Command.stdout("inherit"), Command.stderr("inherit"));
    const code = yield* Command.exitCode(cmd).pipe(Effect.mapError(toGitCommandFailure(args)));
    if (code !== 0) {
      return yield* new GitNonZeroExit({ args, exitCode: code });
    }
  });

/**
 * `git ls-remote --symref origin HEAD`の出力から`refs/heads/<branch>`を抽出する。
 * 期待する出力例:
 * ```
 * ref: refs/heads/master\tHEAD
 * <sha>\tHEAD
 * ```
 */
const parseDefaultBranchFromLsRemote = (
  output: string,
): Effect.Effect<string, LsRemoteParseFailure> =>
  Effect.gen(function* () {
    const refLine = output.split("\n").find((line) => line.startsWith("ref:"));
    const captured = refLine == null ? undefined : /^ref:\s+refs\/heads\/(\S+)/.exec(refLine);
    const branch = captured?.[1];
    if (branch == null) {
      return yield* new LsRemoteParseFailure({ output });
    }
    return branch;
  });

/**
 * `refs/remotes/origin/HEAD`がローカルに設定されているかを終了コードで判定する。
 * `Command.string`は終了コードを検査しないため、この事前チェックを別建てで行う。
 * stderrへ書かれる致命的メッセージは表示しないようパイプで吸収する。
 */
const localOriginHeadExists: Effect.Effect<
  boolean,
  GitCommandFailure,
  CommandExecutor.CommandExecutor
> = Effect.suspend(() => {
  const args = ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"] as const;
  return Command.exitCode(git(...args).pipe(Command.stderr("pipe"))).pipe(
    Effect.mapError(toGitCommandFailure(args)),
    Effect.map((code) => code === 0),
  );
});

/**
 * リモート`origin`のデフォルトブランチを検出する。
 * まずローカルに保持された`refs/remotes/origin/HEAD`を参照し、
 * 設定されていない場合のみ`git ls-remote`でネットワーク経由のフォールバックを行う。
 */
const detectDefaultBranch: Effect.Effect<
  string,
  GitCommandFailure | LsRemoteParseFailure,
  CommandExecutor.CommandExecutor
> = Effect.gen(function* () {
  const exists = yield* localOriginHeadExists;
  if (exists) {
    const local = yield* gitText("symbolic-ref", "--short", "refs/remotes/origin/HEAD");
    return local.trim().replace(/^origin\//, "");
  }
  const lsRemote = yield* gitText("ls-remote", "--symref", "origin", "HEAD");
  return yield* parseDefaultBranchFromLsRemote(lsRemote);
});

/** 現在のブランチ名を取得する。detached HEADでは`HEAD`が返る。 */
const currentBranch: Effect.Effect<string, GitCommandFailure, CommandExecutor.CommandExecutor> =
  gitText("rev-parse", "--abbrev-ref", "HEAD").pipe(Effect.map((out) => out.trim()));

/**
 * HEADにマージ済みのローカルブランチ名を取得する。
 * `git branch --merged`は引数の解釈が`--format`と衝突しやすいため、
 * 安定して機械可読な出力を得られる`for-each-ref`を用いる。
 */
const mergedBranches: Effect.Effect<
  readonly string[],
  GitCommandFailure,
  CommandExecutor.CommandExecutor
> = gitText("for-each-ref", "--merged=HEAD", "--format=%(refname:short)", "refs/heads/").pipe(
  Effect.map((out) =>
    out
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => 0 < line.length),
  ),
);

/**
 * 現在のブランチがリモート`origin`のデフォルトブランチである場合に限り、
 * デフォルトブランチ自身を除いてマージ済みのローカルブランチを削除し、
 * リモート追跡参照を`git fetch --prune`で整理する。
 */
export const deleteMergedBranch: Effect.Effect<
  void,
  DeleteMergedBranchError,
  CommandExecutor.CommandExecutor
> = Effect.gen(function* () {
  const defaultBranch = yield* detectDefaultBranch;
  const current = yield* currentBranch;
  if (current !== defaultBranch) {
    return;
  }
  const merged = yield* mergedBranches;
  const targets = merged.filter((branch) => branch !== defaultBranch);
  if (0 < targets.length) {
    yield* gitInherit("branch", "--delete", ...targets);
  }
  yield* gitInherit("fetch", "--prune");
});
