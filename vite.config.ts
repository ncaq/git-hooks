import path from "node:path";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

/** ESM環境で利用可能な`__dirname`相当のディレクトリパス。 */
const rootDir: string = path.dirname(fileURLToPath(import.meta.url));

/**
 * Node.js向けのCLIバンドル設定。
 */
export default defineConfig({
  root: rootDir,
  build: {
    target: "node22",
    ssr: true,
    outDir: "dist",
    emptyOutDir: true,
    minify: false, // コミットが拒否された時LLMが調査することがあるのであえてminifyしない。
    sourcemap: true,
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
