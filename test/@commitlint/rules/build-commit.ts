import { createCommitObject, type Commit } from "conventional-commits-parser";

/** body部分を指定してテスト用のコミットオブジェクトを生成する。 */
export function buildCommit(body: string | null): Commit {
  return createCommitObject({ header: "feat: x", body });
}
