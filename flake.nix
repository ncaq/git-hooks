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
        "x86_64-darwin"
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
          nodejs = pkgs.nodejs_24;

          npmRoot = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./package.json
              ./package-lock.json
            ];
          };
          nodeModules = pkgs.importNpmLock.buildNodeModules {
            inherit
              nodejs
              npmRoot
              ;
          };

          tsSrc = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./src
              ./script
              ./.editorconfig
              ./.gitignore
              ./commit-msg
              ./commitlint.config.ts
              ./eslint.config.ts
              ./package.json
              ./post-merge
              ./tsconfig.json
            ];
          };

          # npm run経由でスクリプト実行を簡単にするためのヘルパー。
          mkNpmCheck =
            name: script:
            pkgs.runCommand name
              {
                nativeBuildInputs = [ nodejs ];
              }
              ''
                cp -r ${tsSrc}/. .
                ln -s ${nodeModules}/node_modules node_modules
                npm run ${script}
                touch $out
              '';
        in
        {
          packages.default = pkgs.buildNpmPackage {
            pname = "git-hooks";
            version = "0.1.0";

            src = ./.;

            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            inherit (pkgs.importNpmLock) npmConfigHook;

            dontNpmBuild = true;

            installPhase = ''
              runHook preInstall

              mkdir -p $out/lib/git-hooks

              cp -r node_modules $out/lib/git-hooks/
              cp -r script $out/lib/git-hooks/
              cp -r src $out/lib/git-hooks/
              cp commit-msg $out/lib/git-hooks/
              cp commitlint.config.ts $out/lib/git-hooks/
              cp package.json $out/lib/git-hooks/
              cp post-merge $out/lib/git-hooks/

              runHook postInstall
            '';

            meta = {
              description = "Git hooks collection with commitlint";
              homepage = "https://github.com/ncaq/git-hooks";
              license = pkgs.lib.licenses.asl20;
              maintainers = [ ];
            };
          };

          treefmt.config = {
            projectRootFile = "flake.nix";
            programs = {
              actionlint.enable = true;
              deadnix.enable = true;
              nixfmt.enable = true;
              prettier.enable = true;
              shellcheck.enable = true;
              shfmt.enable = true;
              typos.enable = true;
              zizmor.enable = true;

              statix = {
                enable = true;
                disabled-lints = [ "eta_reduction" ];
              };
            };
            settings.formatter = {
              editorconfig-checker = {
                command = pkgs.editorconfig-checker;
                includes = [ "*" ];
              };
            };
          };

          checks = {
            lint-eslint = mkNpmCheck "lint-eslint" "lint:eslint";
            lint-prettier = mkNpmCheck "lint-prettier" "lint:prettier";
            lint-tsc = mkNpmCheck "lint-tsc" "lint:tsc";
          };

          packages = {
            # flake.lockの管理バージョンをre-exportすることで安定した利用を促進。
            inherit (pkgs)
              nix-fast-build
              ;
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
              nix-fast-build

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
