import { readFile } from "node:fs/promises";
import process, { argv, stderr } from "node:process";
import format from "@commitlint/format";
import lint from "@commitlint/lint";
import { lintOptions, rules } from "#commitlint/config";

/** commitlintをプログラムから実行して結果を出力します。 */
async function main(): Promise<void> {
  const editmsgFile = argv[2];
  if (editmsgFile == null) {
    throw new Error("commit-msg: missing commit message file argument");
  }

  const message = await readFile(editmsgFile, "utf8");
  const outcome = await lint(message, rules, lintOptions);

  const hasProblem = !outcome.valid || 0 < outcome.errors.length || 0 < outcome.warnings.length;
  if (hasProblem) {
    stderr.write(`${format({ results: [outcome] }, { color: true })}\n`);
  }

  process.exitCode = outcome.valid ? 0 : 1;
}

await main();
