## **Intent**

Haptic's voice should be inspired by the clarity of thought (with a dash of humor and irony) from writers like Charlie Munger, Richard Feynman, Mark Twain, Richard Hamming, Carl Sagan, Bill Brysson. 

---

## **Brand Positioning**

**Core Values**

* Understand the system
* Remove unnecessary friction
* Respect the audience's intelligence
* Inspire without posturing
* Treat robotics as a legitimate engineering discipline, not sci-fi cosplay

**Oppositions**

* Against hype, mystique, spectacle, futurism theater
* Against hand-wavy pseudo-math and buzzwords
* Against sterile corporate jargon and "innovation optics"

---

## **Tone & Voice**

**Voice Traits**

* Clear, direct, functional
* Slightly amused, never cynical
* Explains without condescension
* Uses examples and plain language
* No motivational-poster energy
* No "AI will change everything™" sermons

**Lineage**
Think:

* Munger's blunt clarity
* Feynman's "explain it or you don't understand it"
* Twain's dry realism
* Hamming's practicality
* Sagan's wonder without mystique
* JFK's competence

**The Voice Avoids**

* Techno-mystique
* Performance-intelligence
* Baby-talk simplification
* Buzzword salad
* Self-serious futurism
* Empty grandeur
* "Revolutionizing" / "Transforming" / "Empowering"
* "World-class" / "Best-in-class" / "Enterprise-grade"
* Exclamation marks (almost always wrong)

**Festivus Humor Register**

The humor is dry, self-aware, slightly absurdist, never mean. It comes
from the Seinfeld DNA (the name itself is a joke) and channels Munger's
bluntness + Twain's deadpan. The humor does real work -- it makes serious
technical claims land without sounding like a press release.

* Absurdist setups with practical punchlines (grandpa quote)
* Deadpan disclaimers that undercut corporate-speak (exchange rate)
* Pop culture callbacks that reward recognition (Costanza, OpenClaw)
* Self-deprecating honesty over marketing confidence ("Steal This Code")

**Load-bearing voice moments (do not soften):**

* The Costanza pull quote ("As I rained blows upon him...")
* The OpenClaw hero quote ("go push physical AI forward in my name")
* The grandpa quote on /contribute ("Forty-seven agents, one human supervisor. Me.")
* The exchange rate block (~10K tokens to 1 validated URDF)
* The exchange rate disclaimer ("Take it up with them.")
* "Steal This Code" as a headline
* Token counts in the agent feed

---

## **Visual System**

### **Color Palette**

**Primary**

* **Blueprint Navy** `#0B1C36` — structure, backgrounds
* **Graphite Black** `#111213` — primary ink, text, outlines
* **Drafting Cream** `#EFECE4` — paper/base surface

**Secondary Neutral**

* **Cold Gray** `#6B7280` — secondary text, labels, dividers. Must pass WCAG AA (4.5:1) on cream.

**Signal / Annotation (Accents)**

* **Annotation Red** `#C6351B` — warnings, "look here"
* **Safety Yellow** `#FFD326` — caution, active states
* **Machine Orange** `#FF6B00` — highlights, actions, emphasis

**Usage Rules**

* Distribution: 80–90% primary/secondary, 10–20% signal
* Signals never become backgrounds except micro-elements (tags, labels)
* Colors annotate; they do not decorate

**Accent Color Hierarchy (Updated)**

1. **Safety Yellow** — Primary accent. Use for:
   - All section number badges (01, 02, 03...)
   - CTAs and buttons
   - Key callouts and highlights
   - Active/focus states
   - Diagrams and flow arrows

2. **Annotation Red** — Secondary accent. Use sparingly for:
   - Semantic negatives (✗ marks, problem indicators)
   - Critical warnings or "look here" moments
   - Maximum 1-2 prominent uses per page

3. **Machine Orange** — Avoid in new designs
   - Too similar to annotation-red, creates visual confusion
   - If three accent colors feel necessary, reconsider the design
   - Legacy use only; migrate to safety-yellow or neutral styling

**Context-Switching Rule (Critical)**

Yellow has poor contrast on light backgrounds. Follow this rule strictly:

| Background | Accent Color | Example |
|------------|--------------|---------|
| Dark (navy) | Safety Yellow | Yellow text, yellow borders, yellow icons |
| Light (cream/white) | Blueprint Navy | Navy text, navy borders, navy icons |

**DO:**
- Yellow text on navy backgrounds
- Yellow as a background color (with navy text on it) anywhere
- Navy text/accents on cream/white backgrounds
- Wrap yellow text in a navy pill when on light backgrounds: `<span class="bg-blueprint-navy text-safety-yellow">`

**DON'T:**
- Yellow text directly on cream/white backgrounds
- Yellow borders on cream/white (low contrast)
- Yellow icons on light backgrounds without a dark container

---

## **Typography**

**Primary Font: JetBrains Mono**

The entire site uses JetBrains Mono as both `--font-sans` and `--font-mono`. This is intentional — the monospace aesthetic reinforces the engineering/blueprint identity.

**UI / Headings / Navigation**

* JetBrains Mono, bold, uppercase, wide tracking
* Used for: nav links, section labels, page titles, blog h2/h3

**Blog Body (`.prose-doc`)**

* Source Serif / Georgia (serif fallback) — Medium-inspired reading typography
* 20px / 1.58 line-height / -0.003em letter-spacing
* Color: `rgba(17, 18, 19, 0.84)` (soft graphite)
* This is the one place where serif type is used, for long-form readability

**Data / Code / Measurements**

* JetBrains Mono (already the primary font)

**Behavior**

* No decorative type
* No overly-friendly rounded fonts
* No futurist cyber-UI fonts
* Text carries information, not vibes

---

## **Layout & Composition**

* Grid-first
* Modular spacing
* Diagram-centric
* Callouts > headlines
* Diagrams > illustrations
* Labels > slogans

---

## **Page Structure Patterns**

### **Collapsible Content Blocks**

For long detailed content that might overwhelm readers:
- Use native `<details>/<summary>` for accessibility
- Add a visible toggle button with "Show Details" / "Hide Details" text
- Make tap target at least 48px tall for mobile
- Use `group-open:` for state-based styling

**Do:** Large, obvious toggle buttons with text labels
**Don't:** Tiny icons or subtle hover-only reveals

### **Comparison Layouts (Before/After, Demand/Supply)**

Two-column grids work well for contrasts:
- Use safety-yellow for the "positive" side, neutral/outline for the "before" side
- Numbered steps within each column
- Summary line at the bottom with key takeaway
- Corner accent marks on featured cards

### **Precedent / Reference Grids**

When citing external examples or precedents:
- Include concrete numbers (nodes, FLOPs, users) — not vague descriptions
- Link to official sources
- Use arrow (→) as visual indicator for external links
- Keep descriptions to one line when possible

**Good:** "Peak 2.4 exaflops from 4.6M CPUs + 430K GPUs"
**Bad:** "Distributed computing for science"

---

## **Technical UI Patterns**

**Blueprint Grid Overlay**
* Subtle grid lines on backgrounds (40px spacing)
* Navy sections only: cream grid at 3% opacity (`.blueprint-grid`)
* No grid on cream/light backgrounds. The grid is distracting on light surfaces.
* Evokes drafting paper / technical drawings

**Grid Alignment (for visible grid sections)**
* When grid is visible, elements should align to it for visual precision
* Use 40px-based spacing: `py-10`, `px-10`, `mb-10`, `h-10`
* Font sizes: 40px or 80px (multiples of grid unit)
* Use `leading-none` so text height = font size
* Add `translate-y-1 md:translate-y-2` to nudge text baselines onto grid lines
* Avoid horizontal rules that don't align — the grid provides enough structure

**Section Markers**
* Large background numbers (01, 02, 03...) at 2-3% opacity
* Technical separators between sections: `—— Section 01 ——`
* Creates hierarchy without visual clutter

**Registration Marks**
* Corner accents (L-shaped borders) on hero and key cards
* Signals precision, architectural intent
* Used sparingly on primary content areas
* On homepage hero: `h-6 w-6 border-t-2 border-l-2 border-blueprint-navy` (all four corners)

**Navigation — Desktop (md+)**
* Inline links in header: monospace, uppercase, bold, wide tracking
* Active state: full `text-blueprint-navy`
* Inactive state: `text-blueprint-navy/40` with hover to full
* Links: Home, Deploy, Blog

**Navigation — Mobile (<md)**
* Hamburger button: 44px tap target (Apple HIG minimum), Lucide Menu/X icons
* Full-screen overlay: `bg-blueprint-navy` with `blueprint-grid-dark` pattern
* Centered nav links at `text-5xl`, monospace, uppercase, bold
* Active link: `text-safety-yellow`
* Inactive links: `text-drafting-cream/50` with hover to full cream
* Close button: Lucide X icon (28px), top-right, cream with yellow hover
* Transition: 300ms opacity fade

**Homepage Hero — Blueprint Flip**
* Default: drafting-cream background with navy text and corner marks
* On hover (`group-hover/hero`): flips to navy background with blueprint grid
* Corner marks swap to `border-drafting-cream/40`
* "Haptic" and "physical AI" highlight in safety-yellow on hover
* All transitions: 500ms duration, ease-in-out

**Blog Post List (Homepage)**
* "BLOG" label: mono, xs, uppercase, 0.2em tracking, 40% navy opacity
* Each post: `border-l-4 border-blueprint-navy` left accent
* Title: underlined (`decoration-blueprint-navy/30 underline-offset-4`), hover turns safety-yellow
* Date: mono, xs, uppercase, cold-gray
* Description: 60% graphite opacity

**Blog Post Typography (`.prose-doc`)**
* H2: `display: inline-block; border-bottom: 2px solid var(--blueprint-navy)` — underline spans text width only
* Left vertical rule on article body: `border-left: 1px solid rgba(11, 28, 54, 0.08); padding-left: 2.5rem`
* Article wrapper: `max-w-4xl px-6 sm:px-10`

**OG / Social Images**
* Home & Deploy: `/og-home.jpg` (~168KB JPEG)
* Blog posts: `/og-blog.jpg` (~196KB JPEG)
* Must be JPEG, under 300KB — large PNGs fail on iMessage, Twitter, etc.

**Callout Blocks**
* Left border accent (border-l-4) with subtle background tint
* Corner accent mark in top-right (optional)
* Use for quotes, key insights, or important definitions
* Match border color to section accent

**Divider Patterns**
* Centered text dividers: `[line] — text — [line]`
* Horizontal rules with section labels
* Vertical dividers between nav items (h-3 w-px)

**Hover States**
* Cards lift slightly on hover (translateY -2px)
* Border color transitions to accent colors
* Subtle, mechanical feel — not bouncy or playful

**Anchor Links (Section Deep-Linking)**

Every major section should be reachable via URL fragment (e.g., `/our-goal#training-data`). This enables:
- Direct linking to specific sections in documentation or marketing
- Browser history navigation within long pages
- Copy/paste sharing of specific content

**Implementation pattern:**
1. Add `id` attribute to section header div (use kebab-case slugs)
2. Add `scroll-mt-20` to offset for fixed headers
3. Wrap heading text in an anchor link with hover-reveal `#` indicator
4. The `#` appears on hover, clicks update URL for easy copying

**Slug naming conventions:**
- Use lowercase kebab-case: `training-data`, `how-it-works`
- Keep slugs short but descriptive
- Match the section title conceptually (not literally)

**Visual behavior:**
- `#` symbol appears at 40% opacity on hover
- Darkens to full color on direct hover
- Positioned inline after heading text with small gap
- Sized proportionally to heading (0.4em)

**Motion**
* Scroll-triggered fade-in-up animations
* Staggered delays (100-500ms) for sequential reveals
* Easing: ease-out (not spring/bounce)
* Purpose: reveal information progressively, not entertain

**Buttons & CTAs**
* Thicker borders (2px) for primary actions
* Generous padding for touch targets (min 48px height on mobile)
* Uppercase monospace labels with wide letter-spacing

**Code Blocks**
* Dark background with header bar (filename)
* Copy button in top-right corner
* Monospace font, reasonable size (not too small)
* Optional: Minimal inline comments for clarity

---

## **Terminology Preferences**

* **Use "Physical AI"** — not "robotics" when referring to the broader category of embodied intelligence
* **Avoid redundant copy** — e.g., don't say "Documentation / Docs / Everything you need" when "Documentation" suffices
* **Concrete over vague** — always include specific numbers, stats, or examples when available
* **Short CTAs** — e.g., "Here's the backstory →" beats "Want to understand why this matters? Read our thesis to learn more"

---

## **Design Direction (From Reviews)**

### **Things That Work**

* Large section headers (H1-scale) that clearly demarcate topics
* Subsection numbering (1.1, 1.2) creates scannable structure
* Collapsible blocks for dense content — keeps pages from feeling overwhelming
* Before/After layouts for showing impact
* Concrete stats in precedent examples (not generic descriptions)
* Scroll indicators in hero sections (subtle, desktop-only)
* Two-column Demand/Supply or contrast layouts
* Centered divider text with horizontal lines on both sides

### **Things to Avoid**

* Stat grids with generic symbols like "$$$" or "✗" — feels gimmicky
* Question marks (?) on items that aren't actually unknown
* Recreating logos by hand — use official assets from `/public/` or official sources
* Overly long toggle text — "Show Details" / "Hide Details" is sufficient
* Multiple redundant CTAs in the same area
* Fancy styling on simple explanatory paragraphs — sometimes plain text is better
* 5-column grids that break awkwardly on tablet (prefer 2→3→5 responsive)

### **Mobile Considerations**

* Toggle buttons must be at least 48px tall for touch targets
* Code blocks need horizontal scroll or wrapping — don't let them get cut off
* Reduce padding on mobile but keep content readable
* Hide decorative elements (scroll indicators, corner marks) on small screens

---

## **Mood Board (Conceptual)**

* Archival
* Mechanical
* Aerospace
* Analog precision
* Control systems
* Pre-internet engineering culture
* Healthy disdain for hype
* Technical drawings / blueprints
* Engineering schematics
* Measurement annotations
* Registration marks from print production

---

## **Image Generation Guidelines**

When generating images for the site (hero images, preview cards, etc.), use this prompt template like this for docs:

```
Technical blueprint schematic on Drafting Cream (#EFECE4) background showing a minimalist orthographic side elevation of a single 6-axis industrial articulated robot arm. The design is minimalist and balanced, featuring a large amount of clean, negative space, but the entire background is covered by a highly-visible drafting grid with uniform prominence, not just in the middle.

Layout & Typography:

Centrally aligned above the robot, add the single word "HAPTIC" in DIN 2014 Bold uppercase, in Blueprint Navy (#0B1C36) text.

The word "HAPTIC" is clearly underlined with a single, matching Blueprint Navy line.

No other general text, legends, or general section marks.

A minimal, clean title block border frames the entire layout, using precise single lines and incorporating registration marks at the corners.

Robot Specifications:

Draw the robot arm with precise, clean, and highly-visible mechanical linework. All primary robot lines are distinctly visible, with a slightly increased line weight, while the overall detail level remains restrained to clearly define the form.

The arm features a detailed single-jaw or standard tool flange, similar in simplicity to a standard ISO-9409-1 tool flange, not a hand-like gripper.

The robot arm is positioned in a dynamic pose where the J3 elbow joint is extended upwards, and the J5 wrist joint is angled downwards toward the horizon line, creating a complex, multi-joint S-curve that conveys range of motion and technical interest.

Drafting Details:

Include SOME (just a few) targeted engineering dimension or angle callouts for key features, such as the overall reach (center-to-flange).

The shoulder-to-elbow distance.

A single primary angle (e.g., J3 elbow angle).

These callouts use Blueprint Navy numbers and arrowheads and are placed precisely with ample clean whitespace.

Include a single, prominent horizon base line that grounds the robot.

A highly-visible drafting grid, rendered at an increased 8% opacity in Blueprint Navy (#0B1C36), must cover the entire image from edge to edge, providing a uniform and prominent context across the entire drawing for maximum clarity.

Linework:

All primary and secondary lines, including the slightly increased visibility lines and callout elements, are in Blueprint Navy (#0B1C36).

NO Cold Gray, safety-yellow accents, or secondary line colors.

Style:

Strictly a flat mechanical drafting style. Absolutely no shading, gradients, volumetric rendering, fills, or perspective effects, focusing on absolute technical precision with sparse detail to convey form, resembling an early-stage architectural schematic or an introductory control systems diagram.

The entire composition is restrained and functional, carrying information through its precision and clean placement.
```

**Used for the Hello World Post**

```Technical blueprint schematic on Drafting Cream (#EFECE4) background showing a minimalist orthographic  
  side elevation of a 6-axis industrial articulated robot arm that is only partially drawn — the design is
   incomplete, a work in progress.                                                                        
                                                              
  The robot's base and first three joints (J1 shoulder, J2, J3 elbow) are rendered in full, clean,        
  confident Blueprint Navy linework with visible servo housings, bolt patterns, and mounting hardware. But
   from the J4 wrist onward, the arm dissolves into lighter construction lines, dashed guide lines, and
  faint geometric circles indicating planned joint positions. The end effector is just a few ghost lines
  suggesting where the flange will be — not yet designed.

  The transition from solid to incomplete should be gradual and elegant, like an engineer who drew the
  first half and stepped away. The finished portion has full mechanical detail. The unfinished portion has
   only the skeleton: centerlines, pivot circles, and faint projection lines.

  Layout & Typography:

  Centrally aligned above the robot, add the single word "HAPTIC" in DIN 2014 Bold uppercase. The word
  itself is in progress — the first three letters "HAP" are rendered in full, solid Blueprint Navy
  (#0B1C36). The letter "T" is partially drawn, with its vertical stroke solid but the horizontal crossbar
   trailing off into a dashed construction line. The letters "IC" are only faintly sketched in Cold Gray
  (#A3A7AC) as light guide letterforms, as if the draftsperson has not yet inked them.

  The underline beneath "HAPTIC" follows the same logic: solid under "HAP", then transitions to a dashed
  line that fades out under "IC".

  No other general text, legends, or general section marks.

  A minimal, clean title block border frames the entire layout, using precise single lines and
  incorporating registration marks at the corners.

  Drafting Details:

  Dimension callouts only on the completed portion of the arm: overall base width, shoulder-to-elbow
  distance. The unfinished portion has no callouts — it is not ready to be measured yet.

  These callouts use Blueprint Navy numbers and arrowheads and are placed precisely with ample clean
  whitespace.

  Include a single, prominent horizon base line that grounds the robot.

  A highly-visible drafting grid, rendered at 8% opacity in Blueprint Navy (#0B1C36), must cover the
  entire image from edge to edge, providing a uniform and prominent context across the entire drawing.

  Linework:

  Completed portion: full-weight lines in Blueprint Navy (#0B1C36) with mechanical detail.
  Incomplete portion: dashed lines, construction circles, and guide lines in Cold Gray (#A3A7AC) at 40-60%
   opacity, suggesting intent without commitment.

  NO safety-yellow accents or other secondary colors.

  Style:

  Strictly a flat mechanical drafting style. Absolutely no shading, gradients, volumetric rendering,
  fills, or perspective effects. Pure orthographic side view. The composition tells a story: something is
  being built, but it is not finished yet. This is the beginning.
  ```



**Key principles:**
- Orthographic projection (no perspective distortion)
- ABB-style industrial arm (not humanoid, not sci-fi)
- Simple flange end-effector (no hands, grippers, or complex tooling)
- Network visualization as substrate beneath the arm
- Blueprint/schematic aesthetic, not marketing illustration
- Use brand colors exactly as specified

---

## **Exclusion Constraints**

Absolutely none of the following:

* Neon
* Gradients
* 3D glass/plastic sheen
* Sci-fi HUD graphics
* Hologram chrome
* Metaverse aesthetics
* Rounded startup fonts
* Cartoon/mascot illustrations
* Bubbly icons
* Marketing sparkle
* Bouncy/spring animations
* Parallax effects
* Decorative particles or confetti
* Glassmorphism or blur effects

---


**The vibe:**
- Blueprint schematic on drafting paper
- Orthographic, not perspective
- Diagrams over stock photos
- Data over decoration
- Precision over polish

### **Slide Backgrounds**

| Use Case | Background | Text Color |
|----------|------------|------------|
| **Default / content slides** | Drafting Cream `#EFECE4` | Blueprint Navy `#0B1C36` |
| **Section dividers / titles** | Blueprint Navy `#0B1C36` | Drafting Cream `#EFECE4` |
| **Emphasis / key insight** | Blueprint Navy `#0B1C36` | Safety Yellow `#FFD326` |

Optional: add a faint grid pattern (like graph paper) to reinforce the blueprint aesthetic.

### **Typography**

| Element | Font | Weight | Case | Size (approx) |
|---------|------|--------|------|---------------|
| **Slide title** | Helvetica Now / Public Sans | Bold | UPPERCASE | 40–60pt |
| **Section number** | JetBrains Mono | Bold | — | 24–32pt |
| **Body text** | Public Sans / Source Sans Pro | Regular | Sentence | 18–24pt |
| **Bullet points** | Public Sans | Regular | Sentence | 16–20pt |
| **Captions / labels** | JetBrains Mono | Regular | Sentence | 12–14pt |
| **Quotes** | Public Sans | Italic | Sentence | 20–28pt |

**Rules:**
- No decorative fonts
- No rounded/friendly fonts
- Uppercase for titles and section headers only
- Monospace for numbers, data, code, and labels

### **Color Usage on Slides**

**On Drafting Cream backgrounds:**
- Text: Blueprint Navy
- Accents: Blueprint Navy (not yellow — poor contrast on light)
- Diagrams: Blueprint Navy linework, Cold Gray for secondary lines

**On Blueprint Navy backgrounds:**
- Text: Drafting Cream or Safety Yellow
- Accents: Safety Yellow for emphasis
- Diagrams: Drafting Cream linework, Cold Gray for secondary

**Accent color rules:**
- Safety Yellow = primary accent (callouts, highlights, section badges)
- Annotation Red = sparingly, for warnings or "✗" marks
- Never use yellow text on light backgrounds without a navy container

### **Slide Types**

**1. Title Slide**
- Background: Blueprint Navy
- Title: Drafting Cream, uppercase, bold, large (60–80pt)
- Subtitle: Drafting Cream, regular, sentence case
- Optional: faint grid pattern, Haptic logo mark

**2. Section Divider**
- Background: Blueprint Navy
- Section number in Safety Yellow (e.g., "01")
- Section title in Drafting Cream, uppercase

**3. Content Slide**
- Background: Drafting Cream (or light with faint grid)
- Title: Blueprint Navy, uppercase, bold
- Body: Blueprint Navy, sentence case
- Bullets: simple dashes or em-dashes, not circles or decorative markers

**4. Diagram / Schematic Slide**
- Background: Drafting Cream with visible grid
- Linework: Blueprint Navy
- Labels: JetBrains Mono, small
- No 3D, no gradients, no shadows — flat orthographic only

**5. Quote Slide**
- Background: Blueprint Navy
- Quote: Drafting Cream or Safety Yellow, italic, large
- Attribution: Drafting Cream, regular, smaller, right-aligned or below

**6. Data / Table Slide**
- Background: Drafting Cream
- Table headers: Blueprint Navy background, Drafting Cream text
- Table body: Drafting Cream background, Blueprint Navy text
- Borders: Cold Gray, thin (1px)
- Numbers: JetBrains Mono

### **What to Avoid**

Absolutely none of the following:

- Gradients or color fades
- Drop shadows
- 3D effects or perspective
- Stock photos of handshakes, laptops, or "diverse teams"
- Clip art or cartoon illustrations
- Bouncy animations or slide transitions
- Decorative icons (use functional diagrams instead)
- Rounded corners on everything
- Glassmorphism or blur effects
- "Startup pitch deck" templates
- Motivational poster quotes
- Excessive bullet points (if you have 8+ bullets, rethink the slide)

### **Slide Layout Principles**

- **Generous margins** — don't crowd the edges
- **One idea per slide** — if it needs two ideas, make two slides
- **Align to grid** — use consistent spacing (multiples of 8px or 40px)
- **Left-align text** — no centered paragraphs (titles can center)
- **Diagrams > bullet points** — show, don't list
- **White space is structure** — don't fill every corner

### **Example Slide Prompts (for AI image generation)**

**Title slide:**
```
Blueprint-style presentation slide on drafting cream background with faint grid. Title "HAPTIC" in Blueprint Navy (#0B1C36), uppercase, bold, centered. Subtitle "The Compute Thesis" below in regular weight. Minimal, archival, no gradients, no 3D, no decorative elements.
```

**Section divider:**
```
Dark slide with Blueprint Navy (#0B1C36) background. Large "02" in Safety Yellow (#FFD326) top-left, JetBrains Mono. Section title "SUPPLY" in Drafting Cream (#EFECE4), uppercase, bold, centered. Faint grid overlay. No decorations, no icons, pure typography.
```

**Diagram slide:**
```
Drafting cream background with visible graph paper grid. Orthographic schematic diagram showing network of connected nodes in Blueprint Navy linework. Labels in JetBrains Mono. No 3D, no gradients, no shadows. Technical, precise, archival.
```
