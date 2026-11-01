# Portfolio

A full-screen, text-free character-art interpretation of *Wanderer above the Sea of Fog*. An AI-extended landscape places the wanderer left of center. Tiny randomized Chinese nature characters follow the terrain, sky, and fog; pointer movement warps the characters with a spring effect.

Hover to attract characters; hold and drag to repel them. Move away and they settle back. Touch dragging and reduced-motion preferences are supported. See [PAINTING.md](PAINTING.md) for artwork provenance and implementation notes.

## Local development

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

## Check and preview production

```sh
npm run check
npm run preview
```

The production build is generated in `dist/`. GitHub Actions checks TypeScript and the build on pushes to `main` and pull requests.

## Hosting later

No hosting is enabled yet. This is a static site with no backend, accounts, environment variables, or API keys. A future static host can build with `npm ci && npm run build` and publish `dist/`. Relative asset paths support both a custom domain and a repository subpath such as `/portfolio/`. There is only one page, so no route rewrites are needed.

## Where to edit

- `src/painting-scene.ts`: the active painting renderer and region-specific character sets.
- `src/assets/`: the original reference and AI-extended landscape.
- `src/sigil-scene.ts`: the preserved procedural sigil scene.
- `src/style.css`: full-screen layout and background.
- `index.html`: page metadata and the text-free homepage shell.

Future portfolio content can be added to the homepage shell without carrying over the original shark demo.

## Credit

Inspired by [ascii-sharks](https://github.com/stackedlol/ascii-sharks). The portfolio uses its own procedural artwork and a standalone scene; small adapted utilities and lifecycle structure are acknowledged in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which retains the upstream MIT notice. See [LICENSE](LICENSE) for new project code.
