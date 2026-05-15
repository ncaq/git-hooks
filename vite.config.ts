import { FileSystem, Path } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

/**
 * ESM環境で利用可能な`__dirname`相当のディレクトリパスと、
 * それを起点とした入力パスをまとめて解決する。
 */
const { rootDir, inputs } = Effect.runSync(
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const here = yield* path.fromFileUrl(new URL(import.meta.url));
    const rootDir = path.dirname(here);
    return {
      rootDir,
      inputs: {
        "commit-msg": path.join(rootDir, "src/hooks/commit-msg.ts"),
        "post-merge": path.join(rootDir, "src/hooks/post-merge.ts"),
      },
    };
  }).pipe(Effect.provide(NodeContext.layer)),
);

/**
 * エントリチャンクとして書き出された成果物に実行属性を付与するviteプラグイン。
 */
const chmodEntryPlugin: Plugin = {
  name: "chmod-entry",
  writeBundle(outputOptions, bundle) {
    const outDir = outputOptions.dir;
    if (typeof outDir !== "string") {
      throw new Error("chmod-entry plugin requires outputOptions.dir to be a string");
    }
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* Effect.forEach(
        Object.values(bundle).filter((chunk) => chunk.type === "chunk" && chunk.isEntry),
        (chunk) => fs.chmod(path.join(outDir, chunk.fileName), 0o755),
        { concurrency: "unbounded", discard: true },
      );
    }).pipe(Effect.provide(NodeContext.layer));
    return Effect.runPromise(program);
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
      input: inputs,
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
