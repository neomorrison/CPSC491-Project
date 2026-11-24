# Docs

Reference material we build the app from. The proposal itself lives in the Google Doc, not here.

| File | What it is |
|---|---|
| [app-flow.html](app-flow.html) | Every screen and where each tap goes. Download it and open it in a browser. |
| [diagrams/](diagrams) | The diagrams in the proposal. Each `.png` has a `.mmd` source file next to it. |

## Editing a diagram

The diagrams are written in [Mermaid](https://mermaid.js.org). Edit the `.mmd` file, then re-render the PNG from inside `docs/diagrams/`:

```bash
npx -p @mermaid-js/mermaid-cli mmdc -i 3-er-diagram.mmd -o 3-er-diagram.png -c config.json -b white -s 3 -w 1400
```

Or paste the `.mmd` file into [mermaid.live](https://mermaid.live) and export a PNG. Add the `config.json` settings there too so the colors stay the same.
