---
name: files
description: Browse directories and view files in the terminal with keyboard navigation.
keywords: [files, browser, directory, viewer, tui, terminal]
---

# File Browser Canvas

Browse directories and view files directly in the terminal with full keyboard navigation.

## Quick Start

```bash
# Browse current directory
bun run src/cli.ts browse

# Browse specific path
bun run src/cli.ts browse ~/Documents

# Show hidden files
bun run src/cli.ts browse --hidden

# View a specific file directly
bun run src/cli.ts show document --file README.md
```

## Keyboard Controls

### Browser Mode

| Key                 | Action                    |
| ------------------- | ------------------------- |
| `↑`/`↓` or `j`/`k`  | Navigate up/down          |
| `Enter`/`→`/`l`     | Open file or enter folder |
| `←`/`h`/`Backspace` | Go to parent directory    |
| `.` or `Ctrl+H`     | Toggle hidden files       |
| `~`                 | Go to home directory      |
| `g` or `Home`       | Go to first item          |
| `End`               | Go to last item           |
| `PgUp`/`PgDn`       | Page up/down              |
| `r` or `F5`         | Refresh directory         |
| `q`                 | Quit                      |

### Viewer Mode (when file is open)

| Key           | Action            |
| ------------- | ----------------- |
| `↑`/`↓`       | Scroll            |
| `PgUp`/`PgDn` | Page up/down      |
| `q`/`Escape`  | Return to browser |

## Supported File Types

The viewer supports text-based files:

- Markdown: `.md`
- Code: `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rb`, `.go`, `.rs`, `.c`, `.cpp`, `.java`, `.kt`, `.swift`
- Config: `.json`, `.yaml`, `.yml`, `.toml`, `.env`
- Web: `.html`, `.css`, `.xml`, `.graphql`
- Shell: `.sh`, `.bash`, `.zsh`
- Text: `.txt`, `.sql`
- Dotfiles: `.gitignore`, `.prettierrc`, `.eslintrc`, etc.

Binary files (images, PDFs, etc.) cannot be viewed.

## Features

- Directory listing with file icons
- File size display
- Sorted: directories first, then alphabetically
- Hidden file toggle
- Seamless navigation between directories
- Inline file viewing with syntax highlighting for markdown

## Example Usage

```bash
# Browse project files
bun run src/cli.ts browse .

# Browse and view markdown docs
bun run src/cli.ts browse docs/

# Quick view a single file
bun run src/cli.ts show document --file package.json
```
