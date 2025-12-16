<p align="center">
  <img width="160" height="160" src="/assets/favicon.png">
</p>

# ⏳ Countdown

Simple, customizeable countdown without ads

## Usage

Specify the following URL parameters:

- time (required, ISO UTC like `2025-01-01T00:00:00Z`)
- title
- description
- footer
- complete
- color (text color)
- bgcolor (background color)
- image (`provider:id`, e.g., `openverse:<uuid>` or `tenor:<id>`)

`time` is required; all other fields are optional.

Visit [https://obartra.github.io/countdown/instructions](https://obartra.github.io/countdown/instructions) for more details.

## Samples

![](./assets/sample.png)

![](./assets/sample2.png)

## Dev

### Setup

Requires Node 25.2.x (see `.nvmrc`) and pnpm 10+.

```sh
pnpm install
sudo apt-get install jq  # For Ubuntu/Debian
brew install jq          # For macOS
```

`pnpm build` bundles the React app into `docs/` (base `/countdown/` for GitHub Pages) and regenerates the instructions page based on the emoji content. `pnpm preview` serves the production build from `docs/`. For local dev, `pnpm start` runs the Vite dev server at `http://localhost:8080/`.
