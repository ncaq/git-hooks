import { spawnSync } from "node:child_process";
import path from "node:path";
import process, { argv } from "node:process";
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

function main(): void {
  try {
    const scriptResult = spawnSync(scriptPath, argv.slice(2), { stdio: "inherit" });
    if (scriptResult.error != null) {
      throw new Error(`failed to execute ${scriptPath}: ${scriptResult.error.message}`, {
        cause: scriptResult.error,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`post-merge: ${msg}`);
    process.exitCode = 1;
  }
}

main();
