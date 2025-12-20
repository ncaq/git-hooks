# git-hooks

自分のGitを使うときの自動化スクリプトをまとめたリポジトリです。
利用しなくなりデータも残っていないブランチを消したり、
commitlintの設定をまとめたりしています。

## 使い方

### home-manager (Nix Flakes)

flake.nixのinputsに追加します。

```nix
{
  inputs = {
    git-hooks.url = "github:ncaq/git-hooks";
  };
}
```

home-managerのmodulesとして有効化します。

```nix
{
  imports = [ inputs.git-hooks.homeManagerModules.default ];
  programs.git-hooks.enable = true;
}
```

`inputs`経由でアクセスしないと無限再帰になりやすいです。

## 含まれるhooks

- `commit-msg`: [commitlint](https://commitlint.js.org/)によるコミットメッセージの検証
- `post-merge`: マージ済みブランチの自動削除
