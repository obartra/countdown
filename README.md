<p align="center">
  <img width="160" height="160" src="/favicon.png">
</p>

# ⏳ Countdown

Simple, customizeable countdown without ads

## Usage

Specify the following URL parameters:

- title
- date
- description
- footer
- complete
- color
- bgcolor
- image

`date` is required, all other fields are optional

Visit [https://obartra.github.io/countdown/instructions](https://obartra.github.io/countdown/instructions) for more details.

## Dev

### Setup

```sh
npm i
sudo apt-get install jq  # For Ubuntu/Debian
brew install jq          # For macOS
```

Regenerate the list of icons with: `./scripts/copy.sh`. You can specify `--use-cache` to use a local copy when available.

`npm run build` regenerates the instructions page based on the emoji content.