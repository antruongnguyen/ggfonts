# Google Fonts CLI

[![Project version](https://img.shields.io/github/package-json/v/antruongnguyen/ggfonts?style=flat-square)](https://github.com/antruongnguyen/ggfonts)
[![Project issues](https://img.shields.io/github/issues/antruongnguyen/ggfonts?style=flat-square)](https://github.com/antruongnguyen/ggfonts/issues)
[![NPM downloads](https://img.shields.io/npm/dt/ggfonts?style=flat-square)](https://www.npmjs.com/package/ggfonts)
[![Project license](https://img.shields.io/github/license/antruongnguyen/ggfonts?style=flat-square)](https://github.com/antruongnguyen/ggfonts/blob/main/LICENSE)

Search and install [Google Fonts](https://fonts.google.com/) from your terminal, with an interactive picker or command-line arguments.

## Installation

Requires **Node.js 22 or newer**. Version 1.1.0 adds the interactive interface and drops Node.js 20 support.

```shell
npm install -g ggfonts
```

## Interactive mode

Run `ggfonts` without arguments in a terminal:

```shell
ggfonts
```

```text
What would you like to do?
  Search and install fonts
  Update font catalogue
  Configure API key
  Exit
```

- Type to filter the font catalogue, use ↑/↓ to choose a font, and press Enter to select it.
- Confirm installation to download and install the font. Progress and results appear before the menu returns.
- Configure an optional Google Fonts API key through a masked prompt, or use the default catalogue without a key.
- Press Escape or Ctrl+C to cancel a prompt; Ctrl+C also stops a running operation.

The catalogue downloads on first use and is cached locally. Choose **Update font catalogue** to refresh it.

## Command mode

Explicit commands remain available for scripts. Running `ggfonts` without arguments outside a terminal prints help.

| Command | Purpose |
| --- | --- |
| `ggfonts search <name>` | Search font families using a fuzzy query |
| `ggfonts install <name>` | Install an exact font family name |
| `ggfonts update` | Refresh the cached font catalogue |
| `ggfonts config --key <key>` | Save a Google Fonts API key |
| `ggfonts config` | Remove the API key and use the default catalogue |
| `ggfonts help [command]` | Show help for the CLI or a command |
| `ggfonts --version` | Show the installed version |

### Search fonts

```shell
ggfonts search fira
ggfonts search 'op san'
ggfonts search rains --max 5
```

Search is case-insensitive. Use `-m, --max <result>` to limit displayed results; the default is 10. If more fonts match, the output reports how many additional results are available.

### Install a font

```shell
ggfonts install 'Fira Code'
ggfonts install 'Open Sans'
```

Provide the exact family name. If there is no exact match, the command prints search suggestions and exits with an error. Downloads and installation failures also produce a nonzero exit code.

### Configure the catalogue

No API key is required by default: `ggfonts` downloads the shared catalogue from this repository. To use the Google Fonts API, follow Google's [API key instructions](https://developers.google.com/fonts/docs/developer_api).

```shell
# Save an API key
ggfonts config --key YOUR_GOOGLE_FONTS_API_KEY

# Refresh metadata using the selected source
ggfonts update

# Remove the key and switch back to the default source
ggfonts config
ggfonts update
```

Changing the key does not refresh existing metadata automatically. Run `ggfonts update` to apply the selected source. The interactive key prompt masks your input.

## Supported platforms and file locations

Fonts install for the current user on macOS, Linux, and Windows.

| Platform | Configuration and catalogue cache | Installed fonts |
| --- | --- | --- |
| macOS | `$HOME/.ggfonts` | `$HOME/Library/Fonts` |
| Linux | `$HOME/.ggfonts` | `$HOME/.local/share/fonts` |
| Windows | `%USERPROFILE%\AppData\Local\ggfonts` | `%LOCALAPPDATA%\Microsoft\Windows\Fonts` |

Linux uses the same user font directory across distributions and refreshes the fontconfig cache with `fc-cache -f` when available. On Windows, fonts are registered for the current user; if per-user installation is unavailable, the installer falls back to system-wide installation in `%WINDIR%\Fonts`, which may require administrator approval.

Downloads use a temporary `tmp` directory inside the configuration directory. Scratch files are removed after a successful installation. Restart applications if newly installed fonts do not appear immediately.

## Development

```shell
npm ci

# Run the CLI from the checkout
node index.js

# Automated command, installer, and wizard tests
npm test

# Real keyboard smoke checks on macOS/Linux (requires Python 3)
python3 test/terminal.py
```

Tests use temporary home directories and simulated downloads, so they do not install fonts or change configuration in your home directory. Windows registry and PowerShell checks use simulations.

[CI](.github/workflows/ci.yml) runs the suite on Node.js 22 and 24 across Linux, macOS, and Windows. Real keyboard checks run on Linux and macOS, and package contents are checked once with `npm pack --dry-run`. The release workflow reuses these checks before publishing.

## Releasing

Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for `antruongnguyen/ggfonts` using the workflow filename `release.yml`. Enable **Allow npm publish**; new trusted publishers allow staged publishing by default. No `NPM_TOKEN` secret is needed.

Push a version tag matching `package.json`:

```shell
git tag v1.1.0
git push origin v1.1.0
```

The [release workflow](.github/workflows/release.yml) waits for CI, checks that the tag matches the package version, and uses Node.js 22 with npm 11 for OIDC publishing. It packs the CLI, publishes that tarball to npm with provenance, and attaches the same tarball to a GitHub release with generated release notes.

## Credit

Built with:

- [@clack/prompts](https://www.npmjs.com/package/@clack/prompts)
- [picocolors](https://www.npmjs.com/package/picocolors)
- [commander](https://www.npmjs.com/package/commander)
- [adm-zip](https://www.npmjs.com/package/adm-zip)
- [fuzzy-search](https://www.npmjs.com/package/fuzzy-search)

## License

[MIT](LICENSE)
