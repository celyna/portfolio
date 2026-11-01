# Painting scene

The homepage currently uses `PaintingScene` in `src/painting-scene.ts`.

- An AI-extended landscape covers the viewport, with the man left of center. The right-hand fog, valleys, and peaks are inferred additions, not part of the original painting. Narrow-screen crops preserve the man at the left third.
- Hover attracts nearby characters with a damped spring effect.
- Hold the pointer down to repel characters; drag to move the distortion.
- Leaving the canvas lets the characters settle back.
- Touch dragging works; reduced-motion preferences disable motion.
- The existing `src/sigil-scene.ts` is preserved. To restore the sigils, import `SigilScene` in `src/main.ts`, instantiate it, and restore the canvas's accessible description.

Painting: Caspar David Friedrich, *Wanderer above the Sea of Fog*.
Reference: https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_sea_of_fog.jpg
The source reproduction is preserved in `src/assets/wanderer.jpg`; the non-destructive, AI-extended version used by the homepage is `src/assets/wanderer-landscape.png`. The display is rendered from ASCII glyphs; the photo itself is not drawn to the visible canvas.

The spring interaction is an independent implementation informed by the attract/push controls at https://asc11.com/library/abstract-brand-wallpaper-variant-b-inter-1-2-1-jpg . No ASC11 source code or image assets are included.

The renderer uses a curated palette of neutral Chinese nature characters, randomized on sampling, with stroke density and opacity preserving the painting. It never picks arbitrary Unicode characters. As with any randomized text, unintended combinations cannot be ruled out completely.

Glyph pools now follow the source landscape: terrain uses mountain/wood/grass/earth characters; sky uses sky/rain/air/wind; fog uses cloud/mist characters. A traced skyline and local brightness classify the layers. Coordinates account for responsive cropping. The figure uses person/clothing/journey characters.
