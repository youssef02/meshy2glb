# Meshy GLB Decryptor

made with ❤️ from Morocco by Youssef Arrassen
>>>
>>> Thanks for the 80+ Stars, due to not getting hired by meshy.ai, if you want to buy me a coffee or shotw support here is my paypal https://www.paypal.com/qrcodes/p2pqrc/AFD4TSNT95MY2
>>> I am doing this to fund my future projects, or if you need special help with a complex ai 3d workflow, i have RTX 3090 ready for the job for 5 euros/dollars, any other type of requests you can contact me at arrassen.youssef@gmail.com
>>>
A Tampermonkey userscript that intercepts and downloads GLB model files from [meshy.ai](https://www.meshy.ai).

## Requirements

- [Tampermonkey](https://www.tampermonkey.net/) browser extension

## Installation

1. Open Tampermonkey → **Create a new script**
2. Open [`script.js`](script.js) from this repository and copy its contents
3. Paste the contents into Tampermonkey
4. Save (`Ctrl+S`)

## Usage

1. Go to `https://www.meshy.ai/workspace`
2. Open a model
3. Click the site's **Export / Download** button to trigger the model load
4. The GLB file downloads automatically — no extra steps needed
5. The green button in the bottom-right corner lets you re-download the captured GLB files

To disable automatic downloads, set `AUTO_DOWNLOAD` to `false` near the top of `pageScript()`. Captured files remain available through the download button.

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
