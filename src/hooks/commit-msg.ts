import { readFile } from "node:fs/promises";
import process, { argv, stderr } from "node:process";
import format from "@commitlint/format";
import lint from "@commitlint/lint";
import { lintOptions, rules } from "#commitlint/config";

/** commitlintをプログラムから実行して結果を出力します。 */
async function main(): Promise<void> {
  try {
    const editmsgFile = argv[2];
    if (editmsgFile == null) {
      throw new Error("commit-msg: missing commit message file argument");
    }

    const message = await readFile(editmsgFile, "utf8");
    const outcome = await lint(message, rules, lintOptions);

    const hasError = 0 < outcome.errors.length;
    const hasWarning = 0 < outcome.warnings.length;

    if (hasError || hasWarning) {
      stderr.write(`${format({ results: [outcome] })}\n`);
    }

    process.exitCode = hasError ? 1 : 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`commit-msg: ${msg}`);
    process.exitCode = 1;
  }
}

await main();
