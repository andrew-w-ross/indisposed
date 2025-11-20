{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  # https://devenv.sh/packages/
  packages = [ pkgs.git ];

  # https://devenv.sh/languages/
  # languages.rust.enable = true;

  languages.javascript = {
    enable = true;
    corepack.enable = true;
  };

  enterShell = ''
    # Avoid git warning about incomplete Nix-provided SDK metadata.
    unset DEVELOPER_DIR
  '';

  # https://devenv.sh/git-hooks/
  # git-hooks.hooks.shellcheck.enable = true;

  # See full reference at https://devenv.sh/reference/options/
}
