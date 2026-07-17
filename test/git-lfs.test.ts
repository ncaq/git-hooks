import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { NodeContext } from "@effect/platform-node";
import { Cause, Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { delegateToGitLfs, GitLfsNonZeroExit, type GitLfsHookName } from "../src/git-lfs";

/**
 * 本物のgitの代わりに呼び出しを記録する偽の`git`実行ファイルを生成する。
 * 受け取った引数を`FAKE_GIT_RECORD`のファイルへ1行1引数で書き出し、
 * `FAKE_GIT_EXIT`が設定されていればその終了コードで終了する。
 */
const installFakeGit = (dir: string): void => {
  const script = join(dir, "git");
  writeFileSync(
    script,
    [
      "#!/bin/sh",
      'printf "%s\\n" "$@" > "$FAKE_GIT_RECORD"',
      'exit "${FAKE_GIT_EXIT:-0}"',
      "",
    ].join("\n"),
  );
  chmodSync(script, 0o755);
};

/** 偽gitが記録した引数列を読み出す。 */
const recordedArgs = (recordFile: string): readonly string[] =>
  readFileSync(recordFile, "utf8")
    .split("\n")
    .filter((line) => 0 < line.length);

/** Effectを実行する補助。`NodeContext`を提供する。 */
const run = (hook: GitLfsHookName, args: readonly string[]): Promise<Exit.Exit<void, unknown>> =>
  Effect.runPromiseExit(delegateToGitLfs(hook, args).pipe(Effect.provide(NodeContext.layer)));

describe("delegateToGitLfs", () => {
  let root: string;
  let recordFile: string;
  let originalPath: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "git-lfs-hook-"));
    recordFile = join(root, "record");
    installFakeGit(root);
    originalPath = env["PATH"];
    env["PATH"] = `${root}:${env["PATH"] ?? ""}`;
    env["FAKE_GIT_RECORD"] = recordFile;
  });

  afterEach(() => {
    env["PATH"] = originalPath;
    delete env["FAKE_GIT_RECORD"];
    delete env["FAKE_GIT_EXIT"];
    rmSync(root, { recursive: true, force: true });
  });

  it("hook名と引数をそのまま`git lfs`へ転送する。", async () => {
    const exit = await run("pre-push", ["origin", "https://example.com/repo.git"]);
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(recordedArgs(recordFile)).toEqual([
      "lfs",
      "pre-push",
      "origin",
      "https://example.com/repo.git",
    ]);
  });

  it("引数が無いhookでも`git lfs <hook>`だけで呼び出す。", async () => {
    const exit = await run("post-commit", []);
    expect(Exit.isSuccess(exit)).toBe(true);
    expect(recordedArgs(recordFile)).toEqual(["lfs", "post-commit"]);
  });

  it("git-lfsが非0で終了した場合は`GitLfsNonZeroExit`で失敗する。", async () => {
    env["FAKE_GIT_EXIT"] = "2";
    const exit = await run("post-checkout", ["0000", "ffff", "1"]);
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.failureOption(exit.cause);
      expect(failure._tag).toBe("Some");
      if (failure._tag === "Some") {
        expect(failure.value).toBeInstanceOf(GitLfsNonZeroExit);
        expect(failure.value).toMatchObject({
          args: ["lfs", "post-checkout", "0000", "ffff", "1"],
          exitCode: 2,
        });
      }
    }
  });
});

describe("git-lfsのエラー型", () => {
  it("GitLfsNonZeroExitの`message`は引数列と終了コードを含む。", () => {
    const err = new GitLfsNonZeroExit({
      args: ["lfs", "pre-push", "origin"],
      exitCode: 2,
    });
    expect(err.message).toBe("git lfs pre-push origin exited with code 2");
    expect(err._tag).toBe("GitLfsNonZeroExit");
    expect(err.args).toEqual(["lfs", "pre-push", "origin"]);
    expect(err.exitCode).toBe(2);
  });
});
