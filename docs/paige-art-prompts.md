# Making a realistic Paige

The Paige that ships with the app is a hand-drawn vector placeholder. For the full painted video-game look, generate four images with an AI image tool (or brief an artist) using the prompts below, then drop them into `assets/host`.

## What the app needs

| File | Mood |
| --- | --- |
| `idle.png` | Default, chatting |
| `thinking.png` | Working out a tricky request |
| `printing.png` | Job sent to the printer |
| `error.png` | Something went wrong |

- **Portrait, 3:4** (e.g. 1200 × 1600). She's shown in a tall card with the top of the picture kept in view, so keep her head in the top third.
- **Waist-up**, facing the viewer, a little space above her hair.
- **Background:** a plain dark background, or transparent PNG if your tool supports it. A dark brick wall with pink neon glow also matches the app.
- `.png`, `.webp`, `.jpg` or `.gif` all work. Keep each file under about 2 MB.
- After swapping, click back into the app and she updates. Type `/mood thinking` (etc.) in the chat to check each one.

## Keep her consistent

Generate **idle** first. Then use it as the reference/character image for the other three (most tools have "use as reference", "character reference" or "vary" options), keep the same seed if your tool shows one, and only change the expression and pose line.

Don't name real games, studios or artists in the prompt: describing the style keeps Paige original and avoids copying anyone's character.

## Base description (paste at the start of every prompt)

> Semi-realistic digital painting in the style of a glossy open-world video game loading screen: bold clean shapes, painted skin shading, crisp highlights, slightly stylised proportions. Waist-up portrait of Paige, a confident glamorous woman in her mid-twenties with long wavy platinum-blonde hair, a few loose strands framing her face, pink sunglasses pushed up on her head, green-blue eyes with winged eyeliner, glossy pink lips, small gold hoop earrings and a thin gold necklace with a heart pendant. She wears a fitted low-cut hot-pink crop top showing a little cleavage, and high-waisted denim shorts. Flirty, cheeky, fun, tasteful and fully clothed. Hot pink and cyan rim lighting, plain dark background, 3:4 portrait.

## Mood lines (add one after the base description)

**idle.png**
> Pose: one hand on her hip, the other raised in a playful peace sign near her face. Expression: confident smirk, one eyebrow raised, looking straight at the viewer.

**thinking.png**
> Pose: one index finger tapping her chin, head tilted slightly. Expression: eyes glancing up and to the side, lips pursed, mischievous and thoughtful.

**printing.png**
> Pose: holding up a freshly printed sheet of paper in one hand, a couple of pages flying around her. Expression: big delighted laugh, eyes squeezed happily, celebrating.

**error.png**
> Pose: one hand pressed to her forehead in mock dramatic despair. Expression: wide eyes, worried eyebrows, a little "oops" pout, still glamorous.

## Tips

- If a tool makes her too revealing or too plain, nudge the words "tasteful", "fully clothed" or "low-cut" up or down; she should be flirty, never explicit.
- If hands come out wrong, regenerate just that image or crop a little tighter.
- Keep a copy of your originals somewhere else; this folder is part of the app.
