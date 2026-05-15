import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chdir, cwd } from "node:process";
import { NodeContext } from "@effect/platform-node";
import { Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteMergedBranch,
  GitNonZeroExit,
  LsRemoteParseFailure,
} from "../src/delete-merged-branch";

/**
 * テスト用の`git`コマンド実行ヘルパ。
 * 子プロセスのstderrを呼び出し例外に含めるため、`stdio`はパイプとする。
 */
const git = (workdir: string, ...args: readonly string[]): string =>
  execFileSync("git", args, {
    cwd: workdir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

/**
 * bareリポジトリと、それをoriginに持つ作業リポジトリを生成する。
 * 既定ブランチを`master`で固定し、初期コミットをpushしてorigin/HEADを設定する。
 */
const initRepo = (root: string): string => {
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  execFileSync("git", ["init", "--quiet", "--bare", "-b", "master", remote], { stdio: "ignore" });
  execFileSync("git", ["clone", "--quiet", remote, work], { stdio: "pipe" });
  git(work, "config", "user.email", "test@example.com");
  git(work, "config", "user.name", "test");
  // ホスト側のglobal hooksが介入しないように無効化する。
  git(work, "config", "core.hooksPath", "/dev/null");
  writeFileSync(join(work, "README.md"), "init\n");
  git(work, "add", "README.md");
  git(work, "commit", "--quiet", "-m", "feat: init");
  git(work, "push", "--quiet", "origin", "master");
  // pushだけではrefs/remotes/origin/HEADが設定されないため明示的に設定する。
  git(work, "remote", "set-head", "origin", "--auto");
  return work;
};

/** ブランチを作って空コミットを1つ積み、元のブランチに戻る。 */
const createBranchWithCommit = (work: string, branch: string): void => {
  git(work, "checkout", "--quiet", "-b", branch);
  git(work, "commit", "--quiet", "--allow-empty", "-m", `feat: ${branch}`);
};

/** ローカルブランチ名一覧をソートして返す。 */
const localBranches = (work: string): readonly string[] =>
  git(work, "for-each-ref", "--format=%(refname:short)", "refs/heads/")
    .split("\n")
    .filter((line) => 0 < line.length)
    .sort();

/** Effectを実行する補助。`NodeContext`を提供する。 */
const run = (): Promise<void> =>
  Effect.runPromise(deleteMergedBranch.pipe(Effect.provide(NodeContext.layer)));

describe("deleteMergedBranch", () => {
  let root: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = cwd();
    root = mkdtempSync(join(tmpdir(), "delete-merged-branch-"));
  });

  afterEach(() => {
    chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it("デフォルトブランチにいる時、マージ済みブランチを削除し未マージは残す。", async () => {
    const work = initRepo(root);
    chdir(work);

    createBranchWithCommit(work, "feat-merged");
    git(work, "checkout", "--quiet", "master");
    git(work, "merge", "--quiet", "--no-ff", "feat-merged", "-m", "feat: merge feat-merged");

    createBranchWithCommit(work, "feat-unmerged");
    git(work, "checkout", "--quiet", "master");

    expect(localBranches(work)).toEqual(["feat-merged", "feat-unmerged", "master"]);

    await run();

    expect(localBranches(work)).toEqual(["feat-unmerged", "master"]);
  });

  it("デフォルトブランチ以外にいる時は何もしない。", async () => {
    const work = initRepo(root);
    chdir(work);

    createBranchWithCommit(work, "feat-merged");
    git(work, "checkout", "--quiet", "master");
    git(work, "merge", "--quiet", "--no-ff", "feat-merged", "-m", "feat: merge feat-merged");
    git(work, "checkout", "--quiet", "-b", "feat-current");

    expect(localBranches(work)).toEqual(["feat-current", "feat-merged", "master"]);

    await run();

    expect(localBranches(work)).toEqual(["feat-current", "feat-merged", "master"]);
  });

  it("マージ済みブランチが無くても失敗しない。", async () => {
    const work = initRepo(root);
    chdir(work);

    createBranchWithCommit(work, "feat-unmerged");
    git(work, "checkout", "--quiet", "master");

    expect(localBranches(work)).toEqual(["feat-unmerged", "master"]);

    const exit = await Effect.runPromiseExit(
      deleteMergedBranch.pipe(Effect.provide(NodeContext.layer)),
    );
    expect(Exit.isSuccess(exit)).toBe(true);

    expect(localBranches(work)).toEqual(["feat-unmerged", "master"]);
  });

  it("ローカルにorigin/HEADが無くてもls-remote経由でデフォルトブランチを解決する。", async () => {
    const work = initRepo(root);
    chdir(work);

    // origin/HEADの参照を取り除き、ls-remoteへのフォールバックを強制する。
    git(work, "symbolic-ref", "--delete", "refs/remotes/origin/HEAD");

    createBranchWithCommit(work, "feat-merged");
    git(work, "checkout", "--quiet", "master");
    git(work, "merge", "--quiet", "--no-ff", "feat-merged", "-m", "feat: merge feat-merged");

    expect(localBranches(work)).toEqual(["feat-merged", "master"]);

    await run();

    expect(localBranches(work)).toEqual(["master"]);
  });
});

describe("delete-merged-branchのエラー型", () => {
  it("GitNonZeroExitの`message`は引数列と終了コードを含む。", () => {
    const err = new GitNonZeroExit({
      args: ["branch", "--delete", "feat-merged"],
      exitCode: 1,
    });
    expect(err.message).toBe("git branch --delete feat-merged exited with code 1");
    expect(err._tag).toBe("GitNonZeroExit");
    expect(err.args).toEqual(["branch", "--delete", "feat-merged"]);
    expect(err.exitCode).toBe(1);
  });

  it("LsRemoteParseFailureの`message`は元の出力を含む。", () => {
    const err = new LsRemoteParseFailure({ output: "garbage output" });
    expect(err.message).toBe(
      "failed to parse default branch from ls-remote output: garbage output",
    );
    expect(err._tag).toBe("LsRemoteParseFailure");
    expect(err.output).toBe("garbage output");
  });
});
