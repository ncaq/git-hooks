import { chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

/** ESM環境で利用可能な`__dirname`相当のディレクトリパス。 */
const rootDir: string = path.dirname(fileURLToPath(import.meta.url));

/**
 * エントリチャンクとして書き出された成果物に実行属性を付与するviteプラグイン。
 */
const chmodEntryPlugin: Plugin = {
  name: "chmod-entry",
  async writeBundle(outputOptions, bundle) {
    const outDir = outputOptions.dir ?? rootDir;
    await Promise.all(
      Object.values(bundle).map(async (chunk) => {
        if (chunk.type !== "chunk" || !chunk.isEntry) {
          return;
        }
        await chmod(path.join(outDir, chunk.fileName), 0o755);
      }),
    );
  },
};

/**
 * Node.js向けのCLIバンドル設定。
 */
export default defineConfig({
  root: rootDir,
  plugins: [chmodEntryPlugin],
  build: {
    target: "node22",
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    minify: false, // コミットが拒否された時LLMが調査することがあるのであえてminifyしない。
    sourcemap: false, // minifyが無効なので生成しない。無効なリンクを作るリスクを無くす。
    rolldownOptions: {
      input: {
        "commit-msg": path.join(rootDir, "src/hooks/commit-msg.ts"),
        "post-merge": path.join(rootDir, "src/hooks/post-merge.ts"),
      },
      output: {
        format: "esm",
        entryFileNames: "hooks/[name]",
        chunkFileNames: "hooks/_chunks/[name]-[hash].js",
        // shebangはエントリチャンクのみに付与する。
        // `postBanner`はrolldown固有でminify後にも挿入されるため安全。
        postBanner: (chunk) => (chunk.isEntry ? "#!/usr/bin/env node" : ""),
      },
    },
  },
  ssr: {
    // 配布物に`node_modules`を含めないため依存をバンドルへインライン化する。
    noExternal: true,
  },
  test: {
    exclude: [...configDefaults.exclude, "**/.direnv/**", "**/dist/**"],
  },
});
