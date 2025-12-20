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
    inputs@{ flake-parts, self, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];

      imports = [
        inputs.flake-parts.flakeModules.modules
        inputs.treefmt-nix.flakeModule
      ];

      flake = {
        modules.homeManager.default = import ./modules/home-manager.nix { inherit self; };
      };

      perSystem =
        { pkgs, ... }:
        let
          nodejs = pkgs.nodejs_24;
        in
        {
          packages.default = pkgs.buildNpmPackage {
            pname = "git-hooks";
            version = "0.1.0";

            src = ./.;

            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;

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

          treefmt = {
            projectRootFile = "flake.nix";
            programs = {
              deadnix.enable = true;
              nixfmt.enable = true;
              shellcheck.enable = true;
              shfmt.enable = true;
            };
          };

          checks.lint = pkgs.buildNpmPackage {
            pname = "git-hooks-lint";
            version = "0.1.0";
            src = ./.;
            npmDeps = pkgs.importNpmLock { npmRoot = ./.; };
            npmConfigHook = pkgs.importNpmLock.npmConfigHook;
            dontNpmBuild = true;
            buildPhase = ''
              runHook preBuild
              npm run lint
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              touch $out
              runHook postInstall
            '';
          };

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.importNpmLock.hooks.linkNodeModulesHook
              nodejs
            ];

            npmDeps = pkgs.importNpmLock.buildNodeModules {
              npmRoot = ./.;
              inherit nodejs;
            };
          };
        };
    };

  nixConfig = {
    extra-substituters = [
      "https://cache.nixos.org/"
      "https://nix-community.cachix.org"
      "https://git-hooks.cachix.org"
    ];
    extra-trusted-public-keys = [
      "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
      "nix-community.cachix.org-1:mB9FSh9qf2dCimDSUo8Zy7bkq5CX+/rkCWyvRCYg3Fs="
      "git-hooks.cachix.org-1:t3VIYDdXlezkNY1/sRtYKzxMVKTgn+uAR9VWCXHRPeI="
    ];
  };
}
