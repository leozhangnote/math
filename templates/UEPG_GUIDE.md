# UEPG — Unit Education Point Page: Builder's Guide

## What is a UEPG?

A UEPG is a **self-contained, single HTML page** that takes a student through a complete learning cycle for **one specific math concept or method**. It requires no backend — everything runs in the browser using vanilla HTML/CSS/JavaScript, with `localStorage` for persistence.

---

## The 6-Step Structure

Every UEPG has exactly these six stages. Steps 1–5 are revealed progressively in the browser. Step 6 (Connections) is a **build-time step** — the builder proposes links and confirms with the owner before wiring them up.

| Step | Section Name           | Purpose |
|------|------------------------|---------|
| 1    | Check Knowledge        | Diagnostic test covering all skill levels of the concept |
| 2    | Checkup Results        | Per-skill feedback + auto-generated lesson cards for weak spots |
| 3    | Target Weak Spots      | Direct instruction on each weak spot + mini-practice per spot |
| 4    | Practice with Feedback | Unlimited randomized practice per skill level with instant tiered feedback |
| 5    | Mastery Test           | Final mixed-level test (≥80% = mastery), best score saved |
| 6    | Connections            | Contextual links to related UEPGs — foundational (remedial) and challenge (advanced) |

---

## Key Concepts Before Building

### Skill Library

The **skill library** is the heart of the page. It maps each `skillId` to:
- `name`: display name (e.g., "Level 1: Basic Reduction")
- `level`: numeric level (1–N); use 0 for rule-check / conceptual skills
- `badgeClass`: CSS class for the level badge (e.g., `"badge-L1"`)
- `summary`: one-sentence description for lesson cards
- `steps`: ordered array of plain-text instruction strings (3–6 steps)
- `example`: a worked example object `{ problemHTML: string, solutionHTML: string }` — use `math.inline()` / `math.frac()` to render math
- `misconception`: the single most common mistake students make at this level (plain text)
- `keyConcepts`: array of `{ label, prompt }` objects — see **AI Help Buttons** section below

Define between **4–8 skills** per UEPG. Each skill corresponds to one difficulty level or sub-concept.

### Question Object Schema

Every question — whether diagnostic, practice, or mastery — must follow this schema:
```js
{
  id: string,            // unique, e.g. "diag_1", "prac_L1_3"
  type: "mc" | "input",  // multiple-choice or free text input
  skills: [skillId],     // which skill(s) this question tests
  promptHTML: string,    // the question rendered as HTML (use math.inline / math.frac)
  answer: {              // the correct answer object
    // For input: { n: number, d: number } for fractions, or { value: number } for plain numbers
    // For mc: { correctIdx: number } — index into the choices array
  },
  explainSteps: [string],// step-by-step explanation shown after answering (may contain rendered HTML)
  hint: string,          // one-sentence hint shown on request (no grade penalty)
  choices: [string]      // MC only — array of rendered HTML strings; use math.inline() for math content
}
```

**MC radio buttons must use the choice index as the `value` attribute**, never the HTML string itself. Embedding rendered HTML in an attribute breaks the attribute boundary. Store `answer.correctIdx` after shuffling choices, not before.

### State Object

One global `state` object holds all runtime data:
```js
const state = {
  studentName: "",
  diagnostic: {
    questions: [],    // generated at start
    answers: {},      // studentAnswer keyed by question id
    results: {}       // { skillId: { correct: N, total: N } }
  },
  weakSkills: [],     // skillIds where score < threshold (e.g. <75%)
  practice: {
    topic: null,      // current skill being practiced
    attempts: 0,
    correct: 0,
    streak: 0
  },
  mastery: {
    questions: [],
    answers: {},
    score: null,
    bestScore: null   // persisted to localStorage
  }
};
```

---

## Math Rendering — `shared/math_helper.js`

All UEPGs use **KaTeX** for math display, loaded from CDN, with a shared utility layer at `shared/math_helper.js`.

### Load Order

Add to `<head>` (in this order):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<link rel="stylesheet" href="../shared/uepg.css">
<style>
  /* page-specific overrides only — hero gradient, custom inputs, etc. */
</style>
```

Add immediately before the page's own `<script>` block:
```html
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script src="../shared/math_helper.js"></script>
```

### API

`math_helper.js` exposes a global `math` object:

| Call | Returns | Notes |
|------|---------|-------|
| `math.inline('\\frac{2}{3}')` | rendered HTML string | Inline math; safe to inject via `innerHTML` |
| `math.block('x^2 + y^2 = z^2')` | rendered HTML string | Display (block) math, centered |
| `math.frac(n, d)` | rendered HTML string | Shortcut for `math.inline('\\frac{n}{d}')` |
| `math.latexPow(base, exp)` | LaTeX string | Returns `'x'` when exp=1, `'1'` when exp=0, `'x^{n}'` otherwise — pass into `math.inline()` |
| `math.gcd(a, b)` | number | Greatest common divisor |
| `math.lcm(a, b)` | number | Least common multiple |
| `math.reduce(n, d)` | `{ n, d }` | Fraction in lowest terms |
| `math.pick(arr)` | element | Random element from array |
| `math.randInt(a, b)` | number | Random integer in [a, b] inclusive |
| `math.shuffle(arr)` | new array | Fisher-Yates shuffle, non-mutating |

**Always use `math.latexPow` when building exponent LaTeX strings.** Never write `x^{${n}}` directly — if `n` is 1, KaTeX renders a visible superscript "1" which is mathematically incorrect.

```js
// Wrong — shows x¹ when n=1
const latex = `x^{${n}}`;

// Correct — shows x when n=1, x^{n} otherwise
const latex = math.latexPow('x', n);
```

### Nested Fraction Display

`math_helper.js` auto-injects a CSS rule on every page that makes the outer fraction bar in nested fractions visually thicker (2px) and slightly wider than its content, while inner fraction bars stay at KaTeX's default thin weight. This creates clear visual hierarchy with no per-page CSS needed.

Use `\dfrac` for the outer level and `\frac` for inner levels:
```js
math.inline(`\\dfrac{\\frac{${a}}{${b}}}{\\frac{${c}}{${d}}}`)
```

### LaTeX Quick Reference

```
Fraction:        \frac{n}{d}
Display frac:    \dfrac{a}{b}   (larger; use for outer level in nested fractions)
Nested fraction: \dfrac{\frac{a}{b}}{\frac{c}{d}}
Superscript:     x^{2}  or  x^2 (single char)
Subscript:       x_{1}
Times:           \times
Divide:          \div
Plus/minus:      \pm
Square root:     \sqrt{x}
Parentheses:     \left( ... \right)
```

---

## Site-Wide Student Name

All UEPGs share one name stored under the key `"uepg_site_name"` in `localStorage`. This means a student enters their name once and it is remembered across all pages in the library.

### Required constants and functions

```js
const NAME_KEY = "uepg_site_name";   // shared across all UEPGs

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function applyName() {
  const saved = localStorage.getItem(NAME_KEY) || "";
  if (saved) {
    state.studentName = saved;
    document.getElementById("name-input").value = saved;
    document.getElementById("greeting-msg").textContent =
      `${getGreeting()}, ${saved}! Ready to practice?`;
  }
}

function saveSiteName(name) {
  localStorage.setItem(NAME_KEY, name);
  state.studentName = name;
}
```

Call `applyName()` on page load. Call `saveSiteName(name)` when the student types their name or clicks Start.

---

## Building a UEPG — Step by Step

### Step 1: Define the Concept and Skills

Answer these questions first:
- **Concept title**: What is this page teaching? (e.g., "Solving Systems of Linear Equations")
- **Grade/audience**: Who is this for?
- **Skill breakdown**: List 4–8 sub-skills or levels, from foundational to advanced.

Example for "Solving N Linear Equations":
- Level 1: Substitution method (2 variables)
- Level 2: Elimination method (2 variables)
- Level 3: Substitution/elimination (3 variables)
- Level 4: Identifying no-solution / infinite-solution cases
- Level 5: Word problems → system setup
- Rule Check: Checking solutions by substitution back

### Step 2: Build the Skill Library

Fill in the `skillLibrary` object in the template with your defined skills. Each entry needs:
- Clear instructional **steps** (plain text, 3–6 items)
- A **worked example** with `problemHTML` and `solutionHTML` — use `math.frac()` and `math.inline()` for all math
- The **#1 misconception** at that level (plain text)
- **`keyConcepts`**: 1–3 key terms or methods that are foundational to understanding this skill. Each is `{ label, prompt }` where `label` is the button text (e.g., `"GCD"`) and `prompt` is a focused, plain-text question sent directly to ChatGPT. See the **AI Help Buttons** section for details.

### Step 3: Write Question Generators

For each skill, write a `generate_[skillId]_question()` function that:
1. Generates random parameters (numbers, variables, etc.) within sensible bounds
2. Computes the correct answer
3. Returns a complete question object (following the schema above)
4. For MC questions: shuffles choices and stores `correctIdx` after shuffling

**Key principle**: Hard-code the *shape* of the problem, randomize the *numbers*.

**MC safety rule**: Use the choice index as the radio button `value`, never the rendered HTML string:
```js
const choices = math.shuffle([correctHTML, ...decoys]);
const correctIdx = choices.indexOf(correctHTML);
return { ..., choices, answer: { correctIdx } };
```

### Step 4: Implement Answer Validation

The validation function must handle:
- **Correct**: answer matches exactly (or is mathematically equivalent)
- **Almost**: answer is in the right form but not fully simplified/complete
- **Wrong**: answer does not match

For numeric answers: compare after parsing.
For fraction answers: reduce both sides with `math.reduce()` before comparing; detect "equivalent but not simplified."
For multi-part answers (e.g., x=2, y=3): parse each variable separately.
For multiple-choice: compare `selectedIdx` (the radio button value, parsed as int) against `answer.correctIdx`.

### Step 5: Build Diagnostic Questions

Create a `buildDiagnosticQuestions()` function that:
- Samples **1–2 questions per skill** (total 6–10 questions)
- Covers every skill at least once
- Uses the same question generators as practice

### Step 6: Build Mastery Test Questions

Create a `buildMasteryQuestions()` function that:
- Generates **10 questions** mixing all skills
- **Weights toward weak skills** (use `state.weakSkills` to over-sample)
- Guarantees at least one question from the hardest skill level
- Shuffles the final array

### Step 7: Connections — Confirm with Owner Before Wiring

> **This step is a human-in-the-loop checkpoint. Do NOT fill in connections autonomously.**

After the main UEPG is complete, the builder must propose connection candidates to the project owner and wait for confirmation before adding any links.

#### Step 1 — Search the registry for candidates

The registry is the authoritative source for what UEPGs exist. Read the grade-based shards:
- **Foundational candidates**: read `registry/registry_grade_{N-1}.json` + `registry/registry_grade_N.json`
- **Challenge candidates**: read `registry/registry_grade_N.json` + `registry/registry_grade_{N+1}.json`

Only consider entries with `status: complete` — never link to drafts or unbuilt pages. If a natural connection doesn't exist yet as a built UEPG, leave it out entirely. Do not add placeholder or empty connection entries.

Scan each entry's `concept_fingerprint`, `topics`, and `skills_summary` for semantic relevance. This is a judgment call — look for concepts this UEPG depends on (foundational) or concepts that build directly on it (challenge).

For full details on registry search scope rules, see `registry/REGISTRY_GUIDE.md`.

#### Step 2 — Propose to owner

Present the suggestions in this format:

```
UEPG Connections for: [This UEPG title]  (Grade N)
Registry shards searched: grade_{N-1} ([X] entries), grade_N ([Y] entries), grade_{N+1} ([Z] entries)

FOUNDATIONAL (shown when student fails mastery test):
  1. [id]: [title] — because [one-sentence reason]
     → Status: [complete: path | planned | needs to be built]
  2. ...

CHALLENGE (shown when student passes mastery test):
  1. [id]: [title] — because [one-sentence reason]
     → Status: [complete: path | planned | needs to be built]
  2. ...

Please confirm, adjust, or add to these suggestions.
After confirmation, the next step is one of:
  A) Wire up links to existing UEPGs immediately
  B) Build one or more of the missing UEPGs from the list above
  C) Queue the missing UEPGs for a future build session
```

#### Step 3 — After owner confirmation

Once confirmed, do all three of the following:

**1. Fill in the `connections` object in this UEPG's HTML:**
```js
const connections = {
  foundational: [
    { title: "FILL IN title", url: "FILL IN relative path or URL", reason: "FILL IN one sentence" },
  ],
  challenge: [
    { title: "FILL IN title", url: "FILL IN relative path or URL", reason: "FILL IN one sentence" },
  ]
};
```

**2. Update the reverse-link in each linked UEPG's HTML** (if it exists and is complete).

**3. Update the registry** — update `connections` in this UEPG's registry entry, and update the reverse-link `connections` in each linked UEPG's registry entry. Both sides must be updated in the same session. Never add entries for unbuilt UEPGs.

#### The bidirectional rule

When UEPG-B is a *challenge* link of UEPG-A, then UEPG-A must be a *foundational* link of UEPG-B — in both the HTML files and the registry. Always update both sides.

---

## UI Structure (HTML Sections)

```
<body>
  <!-- HERO: Back to Library link, title, description, name input, Start/Reset buttons, progress bar -->
  <!-- Always include the Back to Library link as the first element inside #hero:              -->
  <!--   <a href="../index.html" style="color:rgba(255,255,255,.75);...">← Back to Library</a> -->
  <section id="hero">...</section>

  <!-- REFERENCE: quick-reference tips / parent guide (collapsible) -->
  <section id="reference">...</section>

  <!-- STEP 1: Diagnostic test -->
  <section id="section-diagnostic" class="hidden">...</section>

  <!-- STEP 2: Results + Lesson cards -->
  <section id="section-results" class="hidden">...</section>

  <!-- STEP 3+4: Practice area with topic selector -->
  <section id="section-practice" class="hidden">...</section>

  <!-- STEP 5: Mastery test -->
  <section id="section-mastery" class="hidden">...</section>

  <!-- STEP 6: Connections — revealed inside mastery results, not a separate section -->
  <!-- Foundational links shown on fail; challenge links shown on pass             -->
</body>
```

### Progressive Disclosure
- Sections start with class `hidden` (CSS: `display: none`)
- Reveal sections by removing the `hidden` class at the right moment
- Progress bar updates at each stage: 0% → 20% → 55% → 80% → 100%

### `openPractice(topicId)`

`openPractice` accepts an optional `topicId` argument:
- **From a lesson card "Practice this level" button**: call `openPractice('skill_id')` — opens practice pre-selected to that skill.
- **From the "Go to Practice" button** at the bottom of Step 3: call `openPractice()` with no argument — falls back to `state.weakSkills[0] || 'mixed'`.

```js
// Lesson card button — always pass the skill id:
onclick="openPractice('${sid}')"

// Step 3 bottom button — no argument:
onclick="openPractice()"
```

Never call `selectTopic(sid)` separately before `openPractice()` — `openPractice` calls `selectTopic` internally.

---

## AI Help Buttons (Step 3 — Lesson Cards)

Each lesson card in Step 3 contains three types of buttons in a flex row:

```
[ Practice this level ▶ ]  [ Ask AI 🤖 ]  [ Ask about GCD ]  [ Ask about Reciprocal ]  …
```

### `askAI(skillId)` — broad skill help

Opens ChatGPT with a prompt containing the full skill context: student name, grade, skill name, summary, all steps, and the common misconception. Asks for a clear explanation plus 3 practice problems.

Use the student's `state.studentName` (from the site-wide name key) to personalize the prompt.

```js
function askAI(skillId) {
  const sk = skillLibrary[skillId];
  const name = state.studentName ? `My name is ${state.studentName}. ` : "";
  const steps = sk.steps.map((s, i) => `  ${i + 1}. ${s}`).join("\n");
  const prompt = [
    `${name}I am a [Grade N] student practicing [topic].`,
    ``, `I need extra help understanding: ${sk.name}.`,
    ``, `What this skill is about: ${sk.summary}`,
    ``, `Steps involved:`, steps,
    ``, `Common mistake to avoid: ${sk.misconception}`,
    ``, `Please explain clearly and give me 3 practice problems with full solutions.`
  ].join("\n");
  window.open(`https://chat.openai.com/?q=${encodeURIComponent(prompt)}`, "_blank");
}
```

### `askAIConcept(skillId, idx)` — focused concept help

Opens ChatGPT with a narrow, targeted prompt about one specific key concept from `sk.keyConcepts[idx]`. The `prompt` field from the `keyConcept` object is used directly as the core question — the function adds the student name and grade context around it.

```js
function askAIConcept(skillId, idx) {
  const sk = skillLibrary[skillId];
  const concept = sk.keyConcepts[idx];
  const name = state.studentName ? `My name is ${state.studentName}. ` : "";
  const prompt = [
    `${name}I am a [Grade N] student practicing [topic].`,
    ``, `I have a specific question about: ${concept.label}.`,
    ``, concept.prompt
  ].join("\n");
  window.open(`https://chat.openai.com/?q=${encodeURIComponent(prompt)}`, "_blank");
}
```

### Defining `keyConcepts` in the skill library

Each skill entry should include `keyConcepts` with 1–3 entries:

```js
keyConcepts: [
  {
    label: "GCD",   // shown as: "Ask about GCD"
    prompt: "What is the GCD (Greatest Common Divisor)? How do I find it step by step? Show 3 examples."
  },
  {
    label: "Prime Factorization",
    prompt: "How does prime factorization help me find the GCD of two numbers? Walk me through an example."
  }
]
```

**Rules for `prompt`:**
- Plain text only — no HTML, no KaTeX. The text goes directly into a URL query parameter.
- Write it as a direct question or instruction to the AI.
- Do not include the student's name or grade in the prompt — the function adds that context.
- 1–3 sentences is ideal. Focused is better than broad.

If a skill has no important sub-concepts to highlight, set `keyConcepts: []` and no buttons will be rendered.

---

## CSS Patterns

All common UEPG styles are defined in `shared/uepg.css`. **Do not redefine them per page.** Just link the shared file and add a page-specific `<style>` block only for overrides.

Classes available from `shared/uepg.css` — reference only; no need to copy:

### Feedback Colors
```
.feedback-correct  — green background (correct answer)
.feedback-almost   — yellow background (right form, not fully simplified)
.feedback-wrong    — red background (wrong answer)
.feedback-msg.correct / .almost / .wrong  — colored text variants for inline messages
```

### Skill Level Badges
```
.badge-L1 through .badge-L5, .badge-rule
```

### AI Help Buttons
```
.btn-ai         — filled teal (primary "Ask AI" button)
.btn-ai-concept — teal outline (focused concept buttons)
```

### Per-page overrides that ARE appropriate in a page `<style>` block

- **Hero gradient**: `#hero { background: linear-gradient(135deg, #AAAAAA, #BBBBBB); }` — each grade can use its own color palette
- **Page-specific input types** (e.g. free-form fraction inputs, stats bars)
- Any layout needed only for that page's unique practice UI

### Math Rendering

Use `math_helper.js` for all math — do not add custom CSS fraction renderers. The shared library handles rendering, error fallback, and the nested-fraction bar CSS injection automatically. See the **Math Rendering** section above.

---

## JavaScript Utility Functions

Do **not** re-define math or randomization utilities in page scripts. They are all provided by `shared/math_helper.js` via the `math` object. Declare convenience aliases at the top of your page script if preferred:

```js
const { frac, gcd, reduce, pick, randInt, shuffle } = {
  frac:    (n, d) => math.frac(n, d),
  gcd:     (a, b) => math.gcd(a, b),
  reduce:  (n, d) => math.reduce(n, d),
  pick:    (arr)  => math.pick(arr),
  randInt: (a, b) => math.randInt(a, b),
  shuffle: (arr)  => math.shuffle(arr)
};
```

UI and persistence helpers to always include:
```js
// UI
function showSection(id) { document.getElementById(id).classList.remove('hidden'); }
function hideSection(id) { document.getElementById(id).classList.add('hidden'); }
function setProgress(pct, label) { /* update progress bar width and aria-label */ }

// localStorage
function saveProgress() { localStorage.setItem(PAGE_KEY, JSON.stringify({...})); }
function loadProgress() { const s = localStorage.getItem(PAGE_KEY); return s ? JSON.parse(s) : null; }
```

---

## LocalStorage Persistence

Two separate key namespaces:

| Key | Scope | Content |
|-----|-------|---------|
| `"uepg_site_name"` | **Site-wide** — shared across all UEPGs | Student's name |
| `"uepg_[concept_slug]_g[N]"` | **Per-page** | Diagnostic results, weak skills, practice stats, mastery best score |

Save after every meaningful action:
- On name entry (save to site-wide key)
- After submitting diagnostic (results, weak skills)
- After each practice answer (stats)
- After mastery test (best score)

Always check for saved progress on page load and offer to resume.

---

## Naming & File Conventions

- Filename: `[concept_slug]_grade[N].html` (e.g., `linear_equations_2var_grade8.html`)
- PAGE_KEY: `"uepg_[concept_slug]_g[N]"` (e.g., `"uepg_linear_eq_2var_g8"`)
- Skill IDs: short snake_case strings (e.g., `"substitution_2var"`, `"elimination_2var"`)
- File location: `grade_[N]/[filename].html`

---

## Quality Checklist

Before finishing a UEPG, verify:
- [ ] `<link rel="stylesheet" href="../shared/uepg.css">` is in `<head>` (before any page `<style>`)
- [ ] Hero section has `← Back to Library` link as its first element
- [ ] All 5 in-browser sections are present and reveal in the correct order
- [ ] Every skill has at least 1 diagnostic question
- [ ] Question generators never produce invalid/degenerate problems (add bounds checks)
- [ ] MC radio buttons use choice **index** as `value`, not rendered HTML strings
- [ ] `correctIdx` is set **after** shuffling choices, not before
- [ ] Answer validation handles both correct and "almost correct" cases
- [ ] Lesson cards render for all skills, not just weak ones (for direct access)
- [ ] "Practice this level" button calls `openPractice('skillId')` — not `selectTopic(sid); openPractice()`
- [ ] `keyConcepts` filled in for each skill (at least one entry for skills with key named methods)
- [ ] `keyConcepts[].prompt` is plain text only — no HTML or KaTeX
- [ ] All math in `promptHTML`, `explainSteps`, `example.problemHTML/solutionHTML` uses `math.inline()` / `math.frac()`
- [ ] Variable exponents use `math.latexPow(base, n)` — never raw `x^{${n}}`
- [ ] `askAI` and `askAIConcept` prompt strings reference the correct grade and topic (not the template FILL IN placeholders)
- [ ] Mastery test weights weak skills
- [ ] Progress bar reaches 100% on mastery pass
- [ ] Page works fully offline (no CDN dependencies, or CDN has fallback)
- [ ] Mobile responsive (single column below 768px)
- [ ] localStorage save/load works across page refreshes
- [ ] Site-wide name key `"uepg_site_name"` used (not a page-specific name key)
- [ ] Connections proposed to owner and confirmed before wiring
- [ ] Both directions of each confirmed connection are wired (this page ↔ linked page)
- [ ] Registry entry appended to the correct `registry/registry_grade_N.json` shard
- [ ] Connections only point to `status: complete` built UEPGs — no unbuilt targets
- [ ] `_entry_count` and `_last_updated` updated in all touched shards

---

## Related Files

- `UEPG_template.html` — working HTML starter with all boilerplate and `FILL IN:` markers
- `shared/uepg.css` — shared stylesheet for all UEPGs; link from every page's `<head>`
- `shared/math_helper.js` — global math rendering and utility helper; must be loaded on every UEPG page
- `registry/REGISTRY_GUIDE.md` — registry schema, grade-based shard structure, deduplication workflow, and batch planning format
