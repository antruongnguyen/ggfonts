# Google Fonts CLI

[![Project version](https://img.shields.io/github/package-json/v/antruongnguyen/ggfonts?style=flat-square)](https://github.com/antruongnguyen/ggfonts)
[![Project issues](https://img.shields.io/github/issues/antruongnguyen/ggfonts?style=flat-square)](https://github.com/antruongnguyen/ggfonts/issues)
[![NPM downloads](https://img.shields.io/npm/dt/ggfonts?style=flat-square)](https://www.npmjs.com/package/ggfonts)
[![Project license](https://img.shields.io/github/license/antruongnguyen/ggfonts?style=flat-square)](https://github.com/antruongnguyen/ggfonts/blob/main/LICENSE)

Search and install [Google Fonts](https://fonts.google.com/) from your terminal, with an interactive picker or command-line arguments.

## Installation

Requires **Node.js 22 or newer** and an internet connection. No Google Fonts API key or local catalogue file is needed.

```shell
npm install -g ggfonts
```

## Interactive mode

Run `ggfonts` without arguments in a terminal. It loads the current Google Fonts catalogue and opens the font picker directly:

```shell
ggfonts
```

```text
Choose a font (Esc/Ctrl+C to exit)
  Search: Type a font name to search
  Fira Code
  Fira Mono
```

1. Type a font name to filter the list, then use ↑/↓ to highlight a family.
2. Press Enter to select the family.
3. At the installation prompt, **Yes is selected by default**. Press Enter to install, or use ←/→ to choose No and return to the picker.
4. Read the installation report, then search for another family or press Escape/Ctrl+C to exit.

| Key | Action |
| --- | --- |
| Type / Backspace | Edit the search query |
| ↑ / ↓ | Move through matching families |
| Enter | Select a family; confirm the selected Yes/No option |
| ← / → | Change the installation confirmation |
| Escape / Ctrl+C | Cancel a prompt and exit |
| Ctrl+C during installation | Stop the running operation |

If no families match, edit the query. The picker stays open until you select a family or exit.

Successful installation reports include the family name, installed-file count, installation directory, and every installed filename. Detailed download logs are hidden in interactive mode; warnings and errors remain visible. After success, decline, or an installation failure, the app returns to the picker.

The catalogue stays in memory for the current session. Restart `ggfonts` to load the latest list. If the catalogue cannot be loaded, the app reports the error and exits; check your connection and try again.

## Command mode

Explicit commands remain available for scripts. Running `ggfonts` without arguments outside a terminal prints help.

| Command | Purpose |
| --- | --- |
| `ggfonts search <name>` | Search font families using a fuzzy query |
| `ggfonts install <name>` | Install an exact font family name |
| `ggfonts help [command]` or `ggfonts --help` | Show help for the CLI or a command |
| `ggfonts --version` or `ggfonts -v` | Show the installed version |

### Search fonts

```shell
ggfonts search fira
ggfonts search "op san"
ggfonts search sans --max 5
```

Search is case-insensitive and fuzzy, so a partial query such as "op san" can match "Open Sans". Each search loads Google's current catalogue. Use `-m, --max <result>` to limit displayed results; the default is 10. If more fonts match, the output reports how many additional results are available.

### Install a font

```shell
ggfonts install "Fira Code"
ggfonts install "Open Sans"
```

Provide the exact family name and quote names containing spaces. These double-quoted examples work in macOS/Linux shells, PowerShell, and Windows Command Prompt. Exact-name installs request the font's download manifest directly, without loading the catalogue. An unknown family, download failure, or installation failure produces a nonzero exit code; use `ggfonts search` to find the correct name.

Command-mode installation runs immediately without a confirmation prompt. It prints download filenames and storage paths followed by the full installation report.

### Get help

```shell
ggfonts --help
ggfonts help search
ggfonts help install
ggfonts --version
```

### Upgrading from the old catalogue workflow

The `config` and `update` commands are no longer supported. The app gets families directly from Google's [keyless catalogue](https://fonts.google.com/metadata/fonts), and downloads selected fonts from Google's file list. These website endpoints may change; failures are reported with their details.

Old `API_KEY`, `google-fonts.json`, and `google-fonts.min.json` files are ignored. You may remove these files from `$HOME/.ggfonts` on macOS/Linux or `%USERPROFILE%\AppData\Local\ggfonts` on Windows. Keep the `tmp` directory if it contains downloads you want to recover.

## Supported platforms and file locations

Fonts install for the current user on macOS, Linux, and Windows.

| Platform | Download scratch root | Installed fonts |
| --- | --- | --- |
| macOS | `$HOME/.ggfonts/tmp` | `$HOME/Library/Fonts` |
| Linux | `$HOME/.ggfonts/tmp` | `$HOME/.local/share/fonts` |
| Windows | `%USERPROFILE%\AppData\Local\ggfonts\tmp` | `%LOCALAPPDATA%\Microsoft\Windows\Fonts` |

Linux uses the same user font directory across distributions and refreshes the fontconfig cache with `fc-cache -f` when available. On Windows, fonts are registered for the current user; if per-user installation is incomplete or unavailable, the installer falls back to system-wide installation in `%WINDIR%\Fonts`, which requires an elevated terminal.

Downloads include TTF/OTF variants from nested directories. Fonts are placed directly in the OS font directory, with spaces and Unicode in paths and filenames preserved. Each installation uses a unique directory under the download scratch root. Scratch files are removed after success and kept after failure for manual recovery.

## Troubleshooting

- **Unknown font family:** Run `ggfonts search "part of the name"`, then copy the exact family name into `ggfonts install "Family Name"`.
- **Catalogue or download error:** Check your internet connection and retry. An exact-name install does not require the catalogue endpoint, so it can still work when search is unavailable.
- **Installation failed:** Interactive mode shows the error and returns to the picker. Command mode exits with a nonzero status. Downloaded font files remain under the scratch root shown above for manual installation.
- **Windows system-wide installation fails:** Rerun the installation from an elevated terminal if the per-user installation could not complete.
- **Installed fonts do not appear in an app:** Restart that app. Windows may also require signing out and back in after registry changes. A Linux font-cache warning can likewise require restarting applications.

## Development

The root `index.js` is the executable entry point. Application code lives under `src/`:

| File | Responsibility |
| --- | --- |
| `cli.js` | Command registration and CLI error handling |
| `interactive.js` | Font picker, confirmation, progress, and reports |
| `fonts.js` | Catalogue search and manifest-download orchestration |
| `download.js` | JSON responses, redirects, and file downloads |
| `install.js` | Platform installers and installation summaries |
| `filesystem.js` | Recursive font-file and scratch-directory helpers |
| `paths.js` | Platform and home-directory paths |
| `log.js` | Command and interactive logging |

```shell
npm ci

# Run the CLI from the checkout
node index.js

# Automated command, installer, and interactive tests
npm test

# Real keyboard smoke checks on macOS/Linux (requires Python 3)
python3 test/terminal.py
```

Tests use temporary home directories and simulated downloads, so they do not install fonts or change configuration in your home directory. Platform operations are mostly simulated; on Windows, one test also executes the generated PowerShell script against a temporary font directory with registry writes simulated.

Automated tests are grouped into CLI/catalogue, interactive, download, and installation suites under `test/`, with a shared subprocess harness. `test/terminal.py` checks actual keyboard input and rendering. Local implementation notes in `docs/` are ignored by Git and excluded from the npm package.

[CI](.github/workflows/ci.yml) runs the suite on Node.js 22 and 24 across Linux, macOS, and Windows. Real keyboard checks run on Linux and macOS, and package contents are checked once with `npm pack --dry-run`. The release workflow reuses these checks before publishing.

## Releasing

Configure an [npm trusted publisher](https://docs.npmjs.com/trusted-publishers/) for `antruongnguyen/ggfonts` using the workflow filename `release.yml`. Enable **Allow npm publish**; new trusted publishers allow staged publishing by default. No `NPM_TOKEN` secret is needed.

Push a version tag matching `package.json`:

```shell
git tag v2.0.0
git push origin v2.0.0
```

The [release workflow](.github/workflows/release.yml) waits for CI, checks that the tag matches the package version, and uses Node.js 22 with npm 11 for OIDC publishing. It packs the CLI, publishes that tarball to npm with provenance, and attaches the same tarball to a GitHub release with generated release notes.

## Credit

Built with:

- [@clack/prompts](https://www.npmjs.com/package/@clack/prompts)
- [picocolors](https://www.npmjs.com/package/picocolors)
- [commander](https://www.npmjs.com/package/commander)
- [fuzzy-search](https://www.npmjs.com/package/fuzzy-search)

## License

[MIT](LICENSE)
