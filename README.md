# CueFlow Autocue

A fullscreen teleprompter with adjustable text size, scrolling speed, and a focus guide. Scripts and display settings are saved in the browser on the device in use.

## GitHub Pages

The `main` branch deploys automatically to GitHub Pages through the workflow in `.github/workflows/deploy-pages.yml`.

To build the static site locally, run:

```sh
npm ci
npm run pages:build
```

The build is written to `dist-pages/`.
