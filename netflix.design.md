---
version: alpha
name: Netflix
slug: netflix
source: "https://www.netflix.com/"
extractedAt: 2026-05-19
description: "Cinematic subscription product system built around black stages, assertive Netflix red actions, dense poster-led rows, heavy sans headlines, and a split between immersive entertainment marketing and crisp utility account flows."

colors:
  primary: "#E50914"
  accent: "#E50914"
  accentHover: "#C11119"
  accentPressed: "#A80D15"
  ink: "#000000"
  body: "#221F1F"
  muted: "#B3B3B3"
  canvas: "#000000"
  surface: "#161616"
  surfaceAlt: "#232323"
  border: "#808080"
  borderStrong: "#5F5F5F"
  link: "#448EF4"
  success: "#2D8F4E"
  warning: "#B7791F"
  error: "#E50914"
  hero-overlay: "#000000B3"
  help-canvas: "#FFFFFF"
  help-surface: "#F4F4F4"
  rank-number: "#000000"
  footer-text: "#FFFFFFB3"
  on-primary: "#FFFFFF"
  on-dark: "#FFFFFF"

typography:
  display:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 56px
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "0em"
  hero:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 56px
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "0em"
  headline-lg:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 40px
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0em"
  title-lg:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "0em"
  title-md:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0em"
  title-sm:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  body-strong:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0em"
  button:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 24px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0em"
  utility-button:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", Helvetica, Arial, sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.01em"
  legal:
    fontFamily: "\"Netflix Sans\", \"Helvetica Neue\", \"Segoe UI\", Roboto, Ubuntu, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0em"

rounded:
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  pill: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  section: 56px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  button-primary-active:
    backgroundColor: "{colors.accentPressed}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 12px 24px
  button-utility-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.utility-button}"
    rounded: "{rounded.sm}"
    padding: 5px 16px 6px 16px
  button-utility-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.on-dark}"
    typography: "{typography.utility-button}"
    rounded: "{rounded.sm}"
    padding: 5px 16px 6px 16px
  button-utility-secondary-border:
    borderColor: "{colors.border}"
    textColor: "{colors.on-dark}"
    typography: "{typography.utility-button}"
    rounded: "{rounded.sm}"
    padding: 5px 16px 6px 16px
  input-floating-dark:
    backgroundColor: "{colors.hero-overlay}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 24px 16px 8px 16px
  hero-email-frame:
    backgroundColor: "{colors.hero-overlay}"
    borderColor: "{colors.border}"
    rounded: "{rounded.sm}"
    padding: 0px 0px
  feature-card:
    backgroundColor: "{colors.surfaceAlt}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.lg}"
    padding: 24px 16px 96px 16px
  faq-row:
    backgroundColor: "{colors.surfaceAlt}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.sm}"
    padding: 24px 24px
  poster-rank-card:
    backgroundColor: "transparent"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.md}"
    padding: 0px 0px
  signup-panel:
    backgroundColor: "{colors.help-canvas}"
    textColor: "{colors.body}"
    rounded: "{rounded.sm}"
    padding: 0px 0px
  help-header:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body}"
    rounded: "0px"
    padding: 0px 24px
  help-note:
    backgroundColor: "{colors.help-surface}"
    textColor: "{colors.body}"
    typography: "{typography.legal}"
    rounded: "{rounded.sm}"
    padding: 16px 16px
  editorial-header:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    typography: "{typography.body}"
    rounded: "0px"
    padding: 0px 0px
  editorial-article:
    backgroundColor: "{colors.help-canvas}"
    textColor: "{colors.body}"
    typography: "{typography.title-sm}"
    rounded: "0px"
    padding: 0px 0px
---

**Overview**
Netflix uses a split visual system with one unmistakable anchor: `{colors.primary}` on top of deep black or near-black stages. The public homepage is cinematic and immersive, treating the interface like a dark auditorium where posters, large white headlines, and red calls to action do the emotional work. The signup flow keeps the same red brand signal, but flips to a bright utility shell that feels more transactional and less theatrical.

The system becomes even more explicit when you compare product marketing with service and editorial surfaces. Marketing pages use `{colors.canvas}`, `{colors.surface}`, poster grids, and oversized hero copy. Signup and billing-adjacent screens move to `{colors.help-canvas}` with denser information, narrower content columns, and stronger reliance on clean typographic hierarchy. About/News pages borrow the black masthead but introduce magazine-like editorial pacing with white article canvases and tighter headline tracking.

Key Characteristics:
- Use `{colors.primary}` sparingly but forcefully so the red always reads as the decision point.
- Build most hierarchy through contrast, scale, and content imagery rather than decorative effects.
- Favor heavy sans headlines with minimal letter-spacing and direct language.
- Keep action shapes simple: mostly small-radius rectangles, not pills or soft consumer-tech curves.
- Let content rows and poster modules create rhythm; Netflix often feels like a sequence of rails rather than a card grid.
- Use translucent dark form fields on marketing surfaces instead of bright outlined inputs.
- Separate “entertainment mode” and “account/help mode” without losing brand continuity.

**Colors**
Primary & Action

`{colors.primary}` `#E50914` is the core Netflix signal. It appears on the primary CTA, utility sign-in buttons, and logo mark; because most pages are black or white, the red reads hotter and more urgent than it would in a busier palette.

`{colors.accent}` `#E50914` matches the primary action red rather than introducing a second accent family. This keeps the brand system singular and highly memorable.

`{colors.accentHover}` `#C11119` is a conservative darker-hover step derived from Netflix’s existing red treatment and needed for usable component states. Use it only for action feedback, not for secondary decoration.

`{colors.accentPressed}` `#A80D15` is the pressed-state red. It should feel like the same pigment under pressure, not like a different hue.

`{colors.link}` `#448EF4` appears in utility and support contexts rather than in the cinematic marketing shell. It is a functional support color, not part of the emotional hero palette.

Surfaces

`{colors.canvas}` `#000000` is the dominant entertainment background. It creates the “theater” effect that allows bright posters and white text to pop without additional framing.

`{colors.surface}` `#161616` is used for softened dark layers and translucent overlays that sit on top of black. It prevents the interface from collapsing into a single undifferentiated black field.

`{colors.surfaceAlt}` `#232323` is the common elevated dark block for FAQ rows and reason cards. It is one of the key Netflix product surfaces and should be treated as the default dark container.

`{colors.hero-overlay}` `#000000B3` is the semitransparent field and hero-overlay tone. It lets the background imagery stay present while still supporting legible form content.

`{colors.help-canvas}` `#FFFFFF` is the utility-mode page background for signup and editorial article bodies. It acts as a functional reset when the product needs clarity over atmosphere.

`{colors.help-surface}` `#F4F4F4` is used for support or note-like blocks. It is soft rather than stark, which keeps help pages from feeling too enterprise-like.

Neutrals & Text

`{colors.on-dark}` `#FFFFFF` is the primary text color on black, charcoal, and red. Netflix depends heavily on strong white-on-dark contrast instead of layering many gray text values.

`{colors.body}` `#221F1F` is the primary ink on white surfaces such as help and signup screens. It is softer and more branded than pure black.

`{colors.muted}` `#B3B3B3` is used for secondary dark-mode copy and supporting information. It is especially appropriate in footers and lower-priority explanatory text.

`{colors.footer-text}` `#FFFFFFB3` is the footer-specific muted white. Netflix’s footer avoids low-contrast charcoal text and instead uses transparent white over black.

`{colors.border}` `#808080` is the standard field or outline border. It appears most clearly on outlined utility actions and dark input frames.

`{colors.borderStrong}` `#5F5F5F` is the stronger dark neutral for dividers or firmer field definition when `{colors.border}` is too soft.

Semantic

`{colors.success}` `#2D8F4E` is not strongly present in the sampled public marketing pages, so it is included as a restrained operational green for status messaging only. It should stay secondary to Netflix red.

`{colors.warning}` `#B7791F` is likewise a conservative support token for billing or eligibility notices. Avoid bright amber UI that competes with the brand red.

`{colors.error}` `#E50914` aligns errors with the main action color family. On Netflix, error messaging should feel integrated with the core brand rather than introduced through a separate crimson.

Brand-specific Signatures

`{colors.rank-number}` `#000000` supports the homepage’s chart-like title ranking rails, where oversized numerals act almost like editorial infographics behind poster art. This is a distinct Netflix merchandising pattern.

`{colors.ink}` `#000000` deserves its own mention beyond `{colors.canvas}` because Netflix uses true black not only as a background, but as a framing device, logo stage, and masthead foundation.

**Typography**
Font families:
- Primary family: `{typography.body.fontFamily}`
- Help/editorial fallback stack observed on some pages: `"Netflix Sans", Helvetica, Arial, sans-serif`

| Level | Token | Size | Weight | Line-height | Letter-spacing |
|---|---|---:|---:|---:|---:|
| Hero headline | `{typography.hero}` | 56px | 900 | 1.25 | 0em |
| Display headline | `{typography.display}` | 56px | 900 | 1.25 | 0em |
| Help H1 | `{typography.headline-lg}` | 40px | 800 | 1.25 | 0em |
| Signup title | `{typography.title-lg}` | 32px | 700 | 1.28 | 0em |
| Section title | `{typography.title-md}` | 24px | 500 | 1.2 | 0em |
| Editorial subhead | `{typography.title-sm}` | 20px | 500 | 1.5 | -0.01em |
| Body copy | `{typography.body}` | 16px | 400 | 1.5 | 0em |
| Body strong | `{typography.body-strong}` | 16px | 500 | 1.5 | 0em |
| Small label | `{typography.label}` | 14px | 500 | 1 | 0em |
| Hero CTA | `{typography.button}` | 24px | 500 | 1 | 0em |
| Utility button | `{typography.utility-button}` | 14px | 700 | 1.5 | 0.01em |
| Legal/help note | `{typography.legal}` | 13px | 400 | 1.4 | 0em |

Principles:
- Push emphasis through weight before using unusual tracking; Netflix type is blunt, not airy.
- Keep headline tracking neutral or slightly tight, especially in editorial headlines where a small negative track sharpens the voice.
- Use very large headline jumps between tiers. The brand likes obvious hierarchy, not subtle increments.
- Treat button typography differently by context: hero CTAs are large and medium-weight, while utility actions are smaller and bolder.
- Let copy feel conversational and direct; the system supports short, declarative sentences better than abstract marketing prose.

**Layout**
Netflix’s core spacing rhythm is built from `{spacing.xs}`, `{spacing.sm}`, `{spacing.md}`, `{spacing.lg}`, and `{spacing.xl}`, with `{spacing.section}` as the default vertical section interval on desktop marketing pages. On the homepage, content is centered in a wide frame that visually lands around a 960px to 1000px reading area for text blocks, while rail content stretches wider to foreground posters. Signup compresses into a narrower task column, and Help Center pages use a more document-like max width with generous side gutters. Grid behavior is content-led rather than mathematically expressive: hero blocks are centered, poster rows scroll or step horizontally, and support pages become stacked document sections.

Whitespace on Netflix is deliberate but not delicate. The brand leaves enough room for big headlines and hero forms to breathe, then compresses aggressively inside lists, rails, and plan explanations so the user feels momentum rather than spacious luxury.

**Elevation & Depth**
Public Netflix UI is mostly flat. The homepage CTA, sign-in button, FAQ rows, and signup panels rely on color blocking and contrast rather than layered shadows. The About Netflix masthead did show a subtle shadow around `0 4px 4px rgba(0,0,0,0.25)`, but this behaves more like a separation aid than a full depth system.

The bigger source of depth is atmospheric, not material. Netflix creates hierarchy with black-to-charcoal staging, hero imagery, translucent dark overlays, oversized poster art, and occasional ranking numerals. If you add rich drop shadows, glass, or floating-card effects, the result will stop looking like Netflix and start looking like generic streaming UI.

**Components**
Buttons

`button-primary` uses `{colors.primary}`, `{typography.button}`, and `{rounded.sm}` with 12px by 24px padding. It is the bold homepage “commit” control and should only appear when you want the user to begin or advance, not for minor actions.

`button-primary-active` keeps the same shape and typography but shifts to `{colors.accentPressed}`. Netflix feedback should feel immediate and denser, not animated into a new style family.

`button-utility-primary` is the compact red sign-in or utility action style used in tighter headers. Its smaller type and shorter height let the red still read strongly without overpowering dense page chrome.

`button-utility-secondary` is text-first and transparent. Use it in dark contexts where you need a secondary action that stays visible but does not compete with the red primary.

`button-utility-secondary-border` adds a thin `{colors.border}` outline to the compact secondary action. This is especially appropriate in help or account-adjacent chrome where users expect explicit affordances.

Cards & Containers

`feature-card` is the homepage “reasons to join” block, typically a dark container using `{colors.surfaceAlt}` with generous inner padding and room for an illustration or icon near the bottom edge. It is one of the most reusable Netflix marketing modules because it combines copy density with a poster-like dark stage.

`faq-row` is a large clickable dark band rather than a delicate accordion line. It uses `{colors.surfaceAlt}` and generous padding to feel like a content slab.

`poster-rank-card` is mostly content framing, not a decorated card. The poster image and oversized ranking numeral do the visual work, while the container stays transparent or visually silent.

`signup-panel` is intentionally plain. Its job is not to “feel premium” through ornament, but to keep focus on step progression, plan choice, and the next action.

Inputs & Forms

`input-floating-dark` is the signature homepage field style: white text on a translucent dark background with 24px top padding and 8px bottom padding to support a floating-label composition. This is a stronger Netflix signature than a standard outlined text box.

`hero-email-frame` wraps the floating input with a subtle `{colors.border}` and `{rounded.sm}`. The frame is minimal because the black overlay already provides the field silhouette.

Forms on Netflix marketing pages should appear as part of the hero composition, not as a detached enterprise form module. On white utility surfaces, keep forms cleaner and more document-like.

Navigation

`help-header` is a black utility masthead that retains Netflix branding while simplifying the page into task mode. It typically includes the mark, support title, and compact actions.

`editorial-header` behaves similarly, but supports a denser information architecture with locale, category, or corporate links. It feels more like a media masthead than an app navbar.

Homepage navigation is sparse by comparison. It usually prioritizes the mark, language switcher, and sign-in action over a broad menu, reinforcing a focused funnel.

Pricing

The pricing expression on public Netflix pages is mostly typographic rather than card-heavy. Plan distinctions are explained in stacked copy groups, and the emphasis lands on plan names, device counts, resolution, and extra-member allowances rather than glossy pricing cards.

On pricing/help surfaces, it is more accurate to treat plan rows as structured content blocks than as a modern SaaS pricing-table component. Resist the urge to add decorative comparison cards unless the source page clearly does.

Signature Components

The ranking rail is one of the clearest Netflix-specific patterns. It pairs posters with oversized ranking numerals to turn content discovery into a chart experience rather than a neutral carousel.

The “More Reasons to Join” card row is another signature marketing pattern. Each card is a dark story tile with short benefit-led copy and a supporting graphic anchored low in the container.

The floating-label hero email capture is a third key signature. It lets Netflix ask for commitment directly inside the hero without breaking the cinematic stage.

**Do's and Don'ts**
Do's

- Use `{colors.canvas}` or `{colors.help-canvas}` decisively; Netflix screens usually commit to one mode instead of blending dark and light surfaces evenly.
- Let `{colors.primary}` mark the main decision path only, especially on `button-primary` and `button-utility-primary`.
- Scale headlines up to `{typography.hero}` or `{typography.headline-lg}` before adding decorative treatments.
- Build marketing modules from `{colors.surfaceAlt}` blocks such as `feature-card` and `faq-row` instead of inventing new dark grays.
- Keep corners near `{rounded.sm}` or `{rounded.lg}` so containers stay crisp and architectural.
- Use `{colors.hero-overlay}` for homepage-style form capture on image-heavy or black hero surfaces.
- Treat poster art, logos, and ranking numerals as the main visual texture rather than relying on gradients or shadows.

Don'ts

- Do not replace `{colors.primary}` with softer crimson, burgundy, or orange-red; the exact Netflix red is part of the recognition system.
- Do not round buttons into `{rounded.pill}` chips. Netflix actions are rectangular and grounded.
- Do not fill dark screens with many competing accent colors around `{colors.primary}`; it weakens the brand’s single-point emphasis.
- Do not use airy tracked uppercase labels in place of `{typography.body}` and `{typography.label}`. Netflix voice is direct, not fashion-editorial.
- Do not add glassmorphism, blurred cards, or floating shadows to `feature-card` or `faq-row`.
- Do not turn pricing content into bright SaaS comparison tiles unless the real page clearly shows that pattern.
- Do not make helper text lighter than `{colors.footer-text}` on dark surfaces or lower-contrast than `{colors.muted}` where readability drops.

**Responsive Behavior**
| Breakpoint | Min width | Typical behavior |
|---|---:|---|
| `mobile-sm` | 320px | Hero form stacks, posters compress, logo shrinks, compact gutters |
| `mobile-lg` | 480px | CTA and email field still vertical, cards remain single-column |
| `tablet` | 768px | Card rows widen, hero text increases, some two-column support layouts emerge |
| `desktop-sm` | 960px | Header spacing opens, hero email and CTA can sit inline, rail presentation stabilizes |
| `desktop-lg` | 1280px | Wide poster rails, fuller side gutters, stronger cinematic staging |

Touch targets should stay at least 44px tall, with Netflix’s observed primary CTA often landing above that around 56px. Compact utility buttons can look visually smaller, but should still maintain comfortable tap area.

Collapsing strategy:
- Stack the hero email field and `button-primary` vertically below `desktop-sm`.
- Reduce poster count per row before shrinking poster art too aggressively.
- Preserve headline authority on mobile by wrapping, not by dropping immediately to timid sizes.
- Let `feature-card` modules become a single column with full-width tiles rather than cramped two-up cards.
- Move dense support or pricing comparisons into stacked sections with clear typographic separators.

Images on Netflix should crop confidently. Poster and hero imagery are not treated as precious full illustrations; they are stagecraft, so edge cropping and dark overlays are expected parts of the composition.

**Iteration Guide**
1. Check whether the screen clearly resolves to either `{colors.canvas}` entertainment mode or `{colors.help-canvas}` utility mode. Mixed signals usually mean the page has drifted off-brand.
2. Verify the primary action uses `button-primary` or `button-utility-primary` with `{colors.primary}` and not an improvised accent.
3. Audit headline hierarchy against `{typography.hero}`, `{typography.headline-lg}`, and `{typography.title-lg}`. If everything sits near 20px to 24px, the result will feel generic.
4. Inspect corner treatment. If repeated components are using anything softer than `{rounded.lg}` or approaching pills, pull them back.
5. Review dark containers against `{colors.surfaceAlt}`. If each section uses a different charcoal, the interface loses Netflix’s disciplined staging.
6. Look for at least one genuine Netflix pattern when appropriate: `poster-rank-card`, `feature-card`, or `input-floating-dark`. A screen without any of these may be too abstracted from the source system.
7. Remove decorative elevation until only necessary separation remains. If shadows are carrying hierarchy, the composition is probably not relying enough on contrast and scale.
8. Confirm text contrast and red-button contrast against `{colors.on-primary}` and `{colors.on-dark}` so the screen stays accessible while preserving the brand look.

**Known Gaps**
This extraction is strongest on directly observed public web surfaces: the homepage at `https://www.netflix.com/`, the signup plan-selection flow at `https://www.netflix.com/signup`, the pricing/help article at `https://help.netflix.com/en/node/24926`, and the About Netflix product-story page for Profile Transfer. Core colors, headline scales, CTA sizing, utility button treatments, and the dark-vs-light mode split were all observed directly.

Some component internals were derived conservatively rather than read from a published token source. In particular, `{colors.accentHover}`, `{colors.accentPressed}`, and the exact padding model for some unexpanded FAQ and feature cards are inferred from the rendered patterns and standard Netflix interaction logic, not from an exposed design token file.

The sampled pages do not expose the full logged-in playback app, row hover states, title detail drawers, or account-management form library. That means poster rail behavior, hover motion, and deeper product components are represented here by public-facing equivalents and should be treated as approximate until verified against the authenticated application.
