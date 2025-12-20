{
  description = "Git hooks collection with commitlint";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
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

            npmDepsHash = "sha256-k8p4HcjeFRdhz+hy5D9qBJmwJPQVowzLyf5NHITW6hg=";

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
    };
}
