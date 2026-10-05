# tahti-cli

Terminal-first CLI for [Tahti](https://tahti.live) — scriptable access to the
public Tahti API, plus an interactive **`tahti shell`** TUI (blessed + mpv).

Inspired by [antiwork/gumroad-cli](https://github.com/antiwork/gumroad-cli).

## Related repositories

| Repo | Role |
| ---- | ---- |
| **[janiluuk/tahti-cli](https://github.com/janiluuk/tahti-cli)** (this repo) | Standalone CLI package and docs |
| **[janiluuk/tahti-org](https://github.com/janiluuk/tahti-org)** | Tahti API, workers, studio web (`apps/api`, `apps/web`) — the HTTP API this CLI calls |
| **[janiluuk/tahti-player](https://github.com/janiluuk/tahti-player)** | Tahti Player (desktop/web). Active CLI development is also mirrored in [`packages/tahti-cli`](https://github.com/janiluuk/tahti-player/tree/main/packages/tahti-cli) until the split is finished |
| **[janiluuk/tahti-registry](https://github.com/janiluuk/tahti-registry)** | Official plugin/theme Store catalog (`plugins.json`) |
| **[janiluuk/tahti-radio-discord-bot](https://github.com/janiluuk/tahti-radio-discord-bot)** | 24/7 Discord voice bot for Tahti Radio (not an HTTP CLI target) |

Product / mission docs live in tahti-org (`docs/CONSTITUTION.md`,
`docs/AGENT.md`). Streaming architecture:
[`docs/technical/streaming-architecture.md`](https://github.com/janiluuk/tahti-org/blob/main/docs/technical/streaming-architecture.md).

> **Sync note:** Until `@tahti/api-client` is published from tahti-org and this
> repo’s standalone SDK PR lands, the copy under
> [tahti-player `packages/tahti-cli`](https://github.com/janiluuk/tahti-player/tree/main/packages/tahti-cli)
> (e.g. PR [#508](https://github.com/janiluuk/tahti-player/pull/508)) is the
> day-to-day development tree. This repo tracks the same command surface.

## Requirements

- **Node.js** 20+
- **`TAHTI_API_TOKEN`** — personal API token from
  [tahti.live](https://tahti.live) → Settings → Account → API tokens  
  (not required for public `tahti search`)
- **`mpv`** on `PATH` — only for `tahti shell` playback
  ([mpv.io](https://mpv.io/); e.g. `apt install mpv` / `brew install mpv`)

Optional: `TAHTI_API_URL` (default `https://api.tahti.live`).

## Install / run

```bash
git clone https://github.com/janiluuk/tahti-cli.git
cd tahti-cli
pnpm install   # or: npm install
export TAHTI_API_TOKEN=tahti_...
pnpm tahti --help
# or: node ./src/cli.mjs --help
```

From the **tahti-player** monorepo instead:

```bash
pnpm --filter @tahti-player/tahti-cli exec tahti --help
pnpm --filter @tahti-player/tahti-cli exec tahti shell
```

## Auth

Uses Tahti’s existing personal API tokens (`Authorization: Bearer tahti_...`,
read/write scopes). Plain `fetch` against the public HTTP API — no dependency
on the generated `@tahti/api-client` package yet (that package is still
`private` in tahti-org; see the WIP standalone SDK PR).

1. Sign in at [tahti.live](https://tahti.live) → Settings → Account → API tokens
2. `export TAHTI_API_TOKEN=tahti_...`
3. Optionally `export TAHTI_API_URL=https://api.tahti.live`

`import` needs the **write** scope. Other commands work with **read**.

---

## Interactive shell cheatsheet (`tahti shell`)

```bash
export TAHTI_API_TOKEN=tahti_...
# mpv must be installed
pnpm tahti shell
```

Opens a full-screen TUI (blessed). Needs a real terminal (TTY), not a pipe.

### Layout

| Pane | Contents |
| ---- | -------- |
| **Left — Nav** | Library · Search · Radio · Queue |
| **Main — List** | Items for the selected nav pane |
| **Bottom — Now playing** | Title, artist, play/pause, time (from mpv) |

### What each pane does

| Pane | Source | Play |
| ---- | ------ | ---- |
| **Library** | `GET /api/me/sound` | Presigned URL via `GET /api/me/sound/:id/editor/source` → mpv |
| **Search** | Public `GET /api/v1/search/tracks` | Only if the row already has a stream URL (usually none — browse titles, play owned tracks from Library) |
| **Radio** | Tahti Radio HLS (`GET /api/channels/tahti-radio`) + enabled internet-radio presets (`GET /api/v1/internet-radio/presets/enabled`) | Live stream in mpv; clears the progressive queue |
| **Queue** | In-memory queue for this session | Enter plays the selected row |

### Keys

| Key | Action |
| --- | ------ |
| `Tab` | Focus nav ↔ list |
| `↑` / `↓` or `k` / `j` | Move selection |
| `Enter` | Play selection (from Library, also queues the rest below) |
| `a` | Add selection to queue (tracks only; not live radio) |
| `c` | Clear queue |
| `Space` | Play / pause |
| `n` / `p` | Next / previous (queue) |
| `←` / `→` | Seek −5s / +5s |
| `/` | Focus search query (switches to Search) |
| `?` | Help overlay |
| `q` or `Ctrl+C` | Quit (stops mpv) |

### Shell tips

- Missing **mpv** → clear error at play time; install it and retry.
- **Live radio** replaces the current track and clears the progressive queue.
- **Search** is for discovery; catalog rows typically have no stream URL.
- Token is required so Library can resolve play URLs.

---

## One-shot commands

Every command accepts `--help`. Most accept `--json` (raw API body). Tables use
aligned columns; `-` for empty values.

| Command | API | Notes |
| ------- | --- | ----- |
| `tahti whoami [--json]` | `GET /api/auth/me` | No email in table output |
| `tahti library list [--sort <order>] [--json]` | `GET /api/me/sound` | sort: `newest`, `oldest`, `title`, `duration`, `bpm`, `genre` |
| `tahti library show <id> [--json]` | `GET /api/me/sound/:id` | |
| `tahti releases list [--page] [--limit] [--json]` | `GET /api/me/releases` | |
| `tahti releases show <id> [--json]` | `GET /api/me/releases/:id` | Tracklist; no audio URLs in table |
| `tahti search <query> [--page] [--limit] [--json]` | `GET /api/v1/search/tracks` | Public; never sends the token |
| `tahti import <folder> [--recursive] [--dry-run] [--force] [--json]` | uploads prepare/complete | Needs **write** scope |
| `tahti hearthis sets [--json]` | `GET /api/v1/imports/hearthis/me-sets` | Needs hearthis handle on profile |
| `tahti hearthis set <permalink-or-url> [--json]` | set tracks | |
| `tahti hearthis download-set <permalink-or-url> [--out <dir>] [--dry-run] [--force] [--json]` | + hearthis `download_url` | Layout: `Artist/Album (year)/NN - Track.ext` |
| `tahti shell` | library / search / radio + mpv | See cheatsheet above |

### Examples

```bash
pnpm tahti whoami
pnpm tahti library list --sort title
pnpm tahti search night drive --limit 10
pnpm tahti hearthis sets
pnpm tahti hearthis download-set 378936-9675121 --dry-run
pnpm tahti hearthis download-set 378936-9675121 --out ~/Music/hearthis
pnpm tahti shell
```

### hearthis.at discography

Requires `TAHTI_API_TOKEN` and a hearthis.at handle on your Tahti profile
(Settings → Profile). Downloads use hearthis.at `download_url` (original
upload — often WAV/FLAC), never the compressed stream preview.

### import

Uploads each audio file (mp3, flac, wav, aiff, m4a, aac, ogg, opus) as a new
library sound titled from the file name. Skips titles already in the library
unless `--force`. `--dry-run` lists only. Exit code `1` if any file failed.

---

## Errors

| Situation | Message |
| --------- | ------- |
| No `TAHTI_API_TOKEN` (except `search`) | Missing API token… |
| 401 / 403 | Token invalid or missing scope… |
| 404 | API message (e.g. Sound item not found) |
| Network failure | Could not reach the Tahti API at \<url\>… |
| `tahti shell` without TTY | Needs an interactive terminal |
| `tahti shell` without mpv | Install mpv… |

All errors exit with status `1`.

## Development

```bash
pnpm install
pnpm test
pnpm lint   # needs a local eslint setup; in tahti-player use the workspace filter
```

Roadmap / history while the package still lives in the player monorepo:
[`docs/todo/tahti-cli-tool.md`](https://github.com/janiluuk/tahti-player/blob/main/docs/todo/tahti-cli-tool.md).

## License

AGPL-3.0-or-later — same as Tahti (Tahti ry).
