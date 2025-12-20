{
  description = "Git hooks collection with commitlint";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      treefmt-nix,
    }:
    let
      supportedSystems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      treefmtEval = forAllSystems (
        system:
        treefmt-nix.lib.evalModule nixpkgs.legacyPackages.${system} {
          projectRootFile = "flake.nix";
          programs = {
            deadnix.enable = true;
            nixfmt.enable = true;
            shellcheck.enable = true;
            shfmt.enable = true;
          };
        }
      );
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.buildNpmPackage {
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

            meta = with pkgs.lib; {
              description = "Git hooks collection with commitlint";
              homepage = "https://github.com/ncaq/git-hooks";
              license = licenses.asl20;
              maintainers = [ ];
            };
          };
        }
      );

      homeManagerModules.default = import ./modules/home-manager.nix { inherit self; };

      formatter = forAllSystems (system: treefmtEval.${system}.config.build.wrapper);

      checks = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          formatting = treefmtEval.${system}.config.build.check self;
          lint = pkgs.buildNpmPackage {
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
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          nodejs = pkgs.nodejs;
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.importNpmLock.hooks.linkNodeModulesHook
              nodejs
            ];

            npmDeps = pkgs.importNpmLock.buildNodeModules {
              npmRoot = ./.;
              inherit nodejs;
            };
          };
        }
      );
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
