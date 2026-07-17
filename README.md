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
  imports = [ inputs.git-hooks.modules.homeManager.default ];
  programs.git-hooks.enable = true;
}
```

`inputs`経由でアクセスしないと無限再帰になりやすいです。

## 含まれるhooks

- `commit-msg`: [commitlint](https://commitlint.js.org/)によるコミットメッセージの検証
- `post-checkout`: `git lfs post-checkout`への委譲
- `post-commit`: `git lfs post-commit`への委譲
- `post-merge`: `git lfs post-merge`への委譲とマージ済みブランチの自動削除
- `pre-push`: `git lfs pre-push`への委譲

## Git LFSとの関係

`core.hooksPath`を共通hooksへ固定すると、
`git lfs install`が`.git/hooks`へ設置するhooksは実行されなくなります。
その代わりに上記のhooksが同名の`git lfs`サブコマンドへ委譲することで、
LFSを使うリポジトリでも通常通り動作します。
hooksは`git-lfs`をPATHに含めてラップされているため、
利用側で別途git-lfsをインストールする必要はありません。

LFSを使わないリポジトリでは`git lfs`のhookサブコマンドは即座に何もせず終了するので、
リポジトリごとの設定は不要です。

なお`git lfs install`が行うもう1つの仕事である`filter.lfs.*`の設定は、
このリポジトリの管轄外です。
home-managerでは`programs.git.lfs.enable = true;`を設定してください。
