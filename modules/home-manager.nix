{
  self,
}:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.programs.git-hooks;
  package = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
in
{
  options.programs.git-hooks = {
    enable = lib.mkEnableOption "git-hooks with commitlint";

    package = lib.mkOption {
      type = lib.types.package;
      default = package;
      description = "The git-hooks package to use.";
    };
  };

  config = lib.mkIf cfg.enable {
    programs.git.extraConfig.core.hooksPath = "${cfg.package}/lib/git-hooks";
  };
}
