import { spawnSync } from "node:child_process";
import path from "node:path";
import { argv, exit } from "node:process";
import { fileURLToPath } from "node:url";

/**
 * 自身の配置からプロジェクトルートを辿り、
 * bashスクリプトの位置を解決します。
 * `dist/hooks/post-merge`から見て、
 * `script/delete-merged-branch`は二つ上の階層にあります。
 */
const scriptPath: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "script",
  "delete-merged-branch",
);

const result = spawnSync(scriptPath, argv.slice(2), { stdio: "inherit" });

if (result.error != null) {
  throw new Error(`post-merge: failed to execute ${scriptPath}: ${result.error.message}\n`, {
    cause: result.error,
  });
}

exit(result.status ?? 1);
