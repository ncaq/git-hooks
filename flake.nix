{
  description = "Git hooks collection with commitlint";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{
      flake-parts,
      self,
      treefmt-nix,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        inputs.flake-parts.flakeModules.modules
        treefmt-nix.flakeModule
      ];

      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];

      flake = {
        modules.homeManager.default = import ./modules/home-manager.nix { inherit self; };
      };

      perSystem =
        {
          pkgs,
          lib,
          ...
        }:
        let
          inherit (pkgs) nodejs;

          npmFileset = lib.fileset.unions [
            ./package.json
            ./package-lock.json
          ];

          npmRoot = lib.fileset.toSource {
            root = ./.;
            fileset = npmFileset;
          };

          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit
              nodejs
              npmRoot
              ;
          };

          tsFileset = lib.fileset.unions [
            npmFileset

            ./src
            ./test

            ./.editorconfig
            ./.gitignore
            ./eslint.config.ts
            ./tsconfig.json
            ./vite.config.ts
          ];

          tsRoot = lib.fileset.toSource {
            root = ./.;
            fileset = tsFileset;
          };

          # npm run経由でスクリプト実行を簡単にするためのヘルパー。
          mkNpmCheck =
            name: script:
            pkgs.runCommand name
              {
                nativeBuildInputs = [ nodejs ];
              }
              ''
                cp -r ${tsRoot}/. .
                ln -s ${nodeModules}/node_modules node_modules
                npm run ${script}
                touch $out
              '';

          git-hooks = pkgs.buildNpmPackage {
            pname = "git-hooks";
            version = "0.1.0";

            src = tsRoot;

            npmDeps = pkgs.importNpmLock { inherit npmRoot; };
            inherit (pkgs.importNpmLock) npmConfigHook;

            nativeBuildInputs = [ pkgs.makeWrapper ];

            installPhase = ''
              runHook preInstall

              mkdir -p $out/lib/git-hooks

              cp -r dist $out/lib/git-hooks/dist
              cp -r ${./script} $out/lib/git-hooks/script

              chmod +x \
                $out/lib/git-hooks/dist/hooks/commit-msg \
                $out/lib/git-hooks/dist/hooks/post-merge

              runHook postInstall
            '';

            postFixup = ''
              for exec in $out/lib/git-hooks/dist/hooks/commit-msg \
                          $out/lib/git-hooks/dist/hooks/post-merge \
                          $out/lib/git-hooks/script/delete-merged-branch; do
                wrapProgram "$exec" --prefix PATH : ${
                  lib.makeBinPath (
                    with pkgs;
                    [
                      coreutils
                      findutils
                      gawk
                      git
                      gnugrep
                      nodejs
                    ]
                  )
                }
              done
            '';

            meta = {
              description = "Git hooks collection with commitlint";
              homepage = "https://github.com/ncaq/git-hooks";
              license = pkgs.lib.licenses.asl20;
              maintainers = [ ];
            };
          };
        in
        {
          treefmt.config = {
            projectRootFile = "flake.nix";
            programs = {
              actionlint.enable = true;
              deadnix.enable = true;
              nixfmt.enable = true;
              prettier.enable = true;
              shellcheck.enable = true;
              shfmt.enable = true;
              statix.enable = true;
              typos.enable = true;
              zizmor.enable = true;
            };
            settings.formatter = {
              editorconfig-checker = {
                command = pkgs.editorconfig-checker;
                includes = [ "*" ];
              };
              zizmor.options = [ "--pedantic" ];
            };
          };

          checks = {
            inherit git-hooks;
            lint-eslint = mkNpmCheck "lint-eslint" "lint:eslint";
            lint-prettier = mkNpmCheck "lint-prettier" "lint:prettier";
            lint-tsc = mkNpmCheck "lint-tsc" "lint:tsc";
            test = mkNpmCheck "test" "test";
          };

          packages = {
            # flake.lockの管理バージョンをre-exportすることで安定した利用を促進。
            inherit (pkgs)
              nix-fast-build
              ;
            default = git-hooks;
          };

          devShells.default = pkgs.mkShell {
            buildInputs = with pkgs; [
              # treefmtで指定したプログラムの単体版。
              actionlint
              deadnix
              editorconfig-checker
              nixfmt
              prettier
              shellcheck
              shfmt
              statix
              typos
              zizmor

              # nixの関連ツール。
              nil
              nix-fast-build

              # GitHub関連ツール。
              gh

              # Node.js
              nodejs
            ];
            packages = [ pkgs.importNpmLock.hooks.linkNodeModulesHook ];
            npmDeps = nodeModules;
          };
        };
    };

  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org/"
      "https://niks3-public.ncaq.net/"
      "https://ncaq.cachix.org/"
      "https://nix-community.cachix.org/"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "niks3-public.ncaq.net-1:e/B9GomqDchMBmx3IW/TMQDF8sjUCQzEofKhpehXl04="
      "ncaq.cachix.org-1:XF346GXI2n77SB5Yzqwhdfo7r0nFcZBaHsiiMOEljiE="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
    ];
  };
}
