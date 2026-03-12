# Meshy GLB Decryptor

A Tampermonkey userscript that intercepts and downloads GLB model files from [meshy.ai](https://www.meshy.ai).

## Requirements

- [Tampermonkey](https://www.tampermonkey.net/) browser extension

## Installation

1. Open Tampermonkey → **Create a new script**
2. Paste the contents of `meshy-decrypt.user.js`
3. Save (`Ctrl+S`)

## Usage

1. Go to `https://www.meshy.ai/workspace`
2. Open a model
3. Click the site's **Export / Download** button to trigger the model load
4. The GLB file downloads automatically — no extra steps needed
5. The green **💾 GLB (N captured)** button in the bottom-right corner lets you re-download any captured files

## How it works

Meshy serves 3D models as encrypted binary files (`MESHY.AI` header). Decryption happens inside a Web Worker using a WASM module. The script injects into the page context (bypassing Tampermonkey's sandbox) and hooks:

- **`window.Worker`** — intercepts the decrypt worker's message responses to capture the decrypted `ArrayBuffer`
- **`URL.createObjectURL`** — catches any GLB blobs created by the app
- **`window.fetch`** — catches plain (unencrypted) GLB downloads

## Debugging

Open the browser console (`F12`) and filter by `[Meshy:` to see what's happening:

| Log | Meaning |
|-----|---------|
| `[Meshy:WORKER] Created` | Worker hook is active |
| `[Meshy:WORKER] msg type=loaded` | WASM loaded in worker |
| `[Meshy:WORKER] msg type=ready` | Worker authorized |
| `[Meshy:WORKER] DECRYPTED!` | GLB decrypted, capture triggered |
| `[Meshy:CAPTURE] GLB captured!` | File saved, auto-download firing |
