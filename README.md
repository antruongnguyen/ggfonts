# Google Fonts CLI

A CLI tool to search and install font from https://fonts.google.com/

## Installation
```shell
npm install -g gfonts
```

## Usage
```
Syntax: gfonts [options] [command]

Options:
  -h, --help               display help for command

Commands:
  config [options]         Config Google Fonts API Key. If no API key provided, a pre-downloaded Google Fonts metadata will be used.
  update                   Update Google Fonts metadata
  search [options] <name>  Search font
  install <name>           Install font
  help [command]           display help for command
```

### Configure Google Fonts API Key

Follow instruction to get API Key from https://developers.google.com/fonts/docs/developer_api

#### Usage
```
Syntax: gfonts config [options]

Config Google Fonts API Key. If no API key provided, a pre-downloaded Google Fonts metadata will be used.

Options:
  -k, --key <key>  API Key
  -h, --help       display help for command
```

#### Example
```shell
# Set your API key
gfonts config -k YOUR_GOOGLE_FONTS_API_KEY

# Remove API Key and use the default config
gfonts config
```

### Update Google Fonts metadata

#### Usage
```
Syntax: gfonts update [options]

Options:
  -h, --help  display help for command
```

#### Example
```shell
gfonts update
```

### Search font

#### Usage
```
Syntax: gfonts search [options] <name>

Arguments:
  name                font name.

Options:
  -m, --max <result>  max result limit (default: 10)
  -h, --help          display help for command
```

#### Example
```shell
# Full-text search is supported
gfonts search 'op san'

# OUTPUT:
# [INFO]  Search font by keyword: op san
# [INFO]  Found 2 fonts:
# [INFO]   1. Open Sans
# [INFO]   2. Ropa Sans

gfonts search -m 5 rains
# gfonts search -m=5 rains
# gfonts search --max 5 rains
# gfonts search --max=5 rains

# OUTPUT:
# [INFO]  Search font by keyword: rains
# [INFO]  Found 7 fonts:
# [INFO]   1. JetBrains Mono
# [INFO]   2. Noto Serif Balinese
# [INFO]   3. Noto Traditional Nushu
# [INFO]   4. Racing Sans One
# [INFO]   5. Saira Semi Condensed
# [INFO]  ... and 2 more results
```

### Download and install font

#### Usage
```
Usage: gfonts install [options] <name>

Arguments:
  name        exact font name.

Options:
  -h, --help  display help for command
```

#### Example
```shell
gfonts install 'Open Sans'

# Suggest the font name based on the input if no font matches
gfonts install fira

# OUTPUT:
# [WARN]  No font found with name: fira
# [INFO]  Search font by keyword: fira
# [INFO]  Found 13 fonts:
# [INFO]   1. Finger Paint
# [INFO]   2. Fira Code
# [INFO]   3. Fira Mono
# [INFO]   4. Fira Sans
# [INFO]   5. Fira Sans Condensed
# [INFO]   6. Fira Sans Extra Condensed
# [INFO]   7. Flow Circular
# [INFO]   8. Fontdiner Swanky
# [INFO]   9. Fredericka the Great
# [INFO]  10. Noto Kufi Arabic
# [INFO]  ... and 3 more results
```

## Supported OS
- Linux: Debian-based OS, Arch-based OS, CentOS, Alpine, Fedora
- macOS
- Windows

### `gfonts` configuration directory
- Linux: `$HOME/.gfonts`
- macOS: `$HOME/.gfonts`
- Windows: `%LOCALAPPDATA%\gfonts`

### Font download location
- Linux: `$HOME/Downloads`
- macOS: `$HOME/Downloads`
- Windows: `%USERPROFILE%\Downloads`

### Font install location
- Linux
  - Debian-based OS: `$HOME/.local/share/fonts`
  - Arch-based OS: `$HOME/.local/share/fonts`
  - CentOS: `$HOME/.fonts`
  - Alpine: `$HOME/.fonts`
  - Fedora: `/usr/share/fonts/[Font Name]`
- macOS: `$HOME/Library/Fonts`
- Windows: `%WINDIR%\Fonts`

## Credit
`gfonts` wouldn't be possible without using the following modules: 
- [commander](https://www.npmjs.com/package/commander)
- [adm-zip](https://www.npmjs.com/package/adm-zip)
- [fuzzy-search](https://www.npmjs.com/package/fuzzy-search)

## License
Licensed under MIT
