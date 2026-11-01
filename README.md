# Portfolio

A minimal personal portfolio beginning with a full-screen, text-free ASCII cybersigilism homepage. Tiny black glyphs form intricate sigils with varied silhouettes, sizes, random placement, and one oversized diagonal piece. Click or tap to rearrange. Reduced-motion preferences are supported.

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

- `src/sigil-scene.ts`: the animation and procedural forms.
- `src/style.css`: full-screen layout and background.
- `index.html`: page metadata and the text-free homepage shell.

Future portfolio content can be added to the homepage shell without carrying over the original shark demo.

## Credit

Inspired by [ascii-sharks](https://github.com/stackedlol/ascii-sharks). The portfolio uses its own procedural artwork and a standalone scene; small adapted utilities and lifecycle structure are acknowledged in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which retains the upstream MIT notice. See [LICENSE](LICENSE) for new project code.
