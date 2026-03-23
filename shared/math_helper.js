/**
 * math_helper.js — Global math rendering and utility helper for all UEPG pages.
 *
 * DEPENDS ON: KaTeX (must be loaded via CDN before this script).
 *
 * USAGE in each UEPG page — add to <head>:
 *   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
 *
 * Add before the page's own <script> block:
 *   <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
 *   <script src="../shared/math_helper.js"></script>
 *
 * Then use anywhere in the page script:
 *   math.inline('\\frac{2}{3}')          → inline rendered HTML string
 *   math.block('x^2 + y^2 = z^2')        → display-mode rendered HTML string
 *   math.frac(2, 3)                       → shortcut: inline \frac{2}{3}
 *   math.frac('x^2 + 1', 'y - 3')        → fraction with LaTeX expressions
 *   math.latexPow('x', 2)                 → LaTeX string 'x^{2}'; returns 'x' when exp=1, '1' when exp=0
 *   math.gcd(12, 18)                      → 6
 *   math.reduce(4, 6)                     → { n: 2, d: 3 }
 *   math.pick([1,2,3])                    → random element
 *   math.randInt(1, 10)                   → random integer in [1, 10]
 *   math.shuffle([1,2,3])                 → new shuffled array
 *
 * LaTeX quick reference for common math patterns:
 *   Fraction:        \frac{n}{d}
 *   Superscript:     x^{2}  or  x^2 (single char)
 *   Subscript:       x_{1}
 *   Multiply dot:    \times
 *   Divide:          \div
 *   Plus/minus:      \pm
 *   Square root:     \sqrt{x}
 *   Parentheses:     \left( ... \right)
 *   Absolute value:  |x|  or  \left| x \right|
 *   Nested fraction: \dfrac{\frac{a}{b}}{\frac{c}{d}}
 *   Display frac:    \dfrac{a}{b}  (larger, for nested use)
 *
 * Auto-injected CSS (applied globally on every UEPG page):
 *   - Outer KaTeX fraction bars are slightly thicker (0.08em) for visual hierarchy.
 *   - Nested (inner) fraction bars stay at the default thickness (0.04em).
 */

const math = (() => {
  "use strict";

  /* ── Global Style Injection ───────────────────────────────────────────────── */

  /**
   * Inject fraction-hierarchy CSS into the page once.
   * Outer .frac-line bars are thickened; nested bars stay at KaTeX default.
   * Called automatically on DOMContentLoaded (or immediately if DOM is already ready).
   */
  function _injectStyles() {
    const id = "math-helper-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      /* Outer KaTeX fraction bars: thicker and slightly wider than the content */
      .katex-html .mfrac .frac-line {
        border-bottom-width: 2px;
        margin-left: -4px;
        margin-right: -4px;
      }
      /* Inner (nested) fraction bars: thin, no extension — clearly subordinate */
      .katex-html .mfrac .mfrac .frac-line {
        border-bottom-width: 0.04em;
        margin-left: 0;
        margin-right: 0;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", _injectStyles);
  } else {
    _injectStyles();
  }

  /* ── Rendering ───────────────────────────────────────────────────────────── */

  /**
   * Render a LaTeX string as inline math.
   * @param {string|number} latex
   * @returns {string} HTML string, safe to inject via innerHTML
   */
  function inline(latex) {
    try {
      return katex.renderToString(String(latex), {
        throwOnError: false,
        displayMode: false,
        output: "html"
      });
    } catch (e) {
      console.warn("math.inline error:", e.message, "| input:", latex);
      return `<span style="color:red;font-family:monospace" title="${e.message}">${latex}</span>`;
    }
  }

  /**
   * Render a LaTeX string as block (display) math.
   * @param {string|number} latex
   * @returns {string} HTML string, safe to inject via innerHTML
   */
  function block(latex) {
    try {
      return katex.renderToString(String(latex), {
        throwOnError: false,
        displayMode: true,
        output: "html"
      });
    } catch (e) {
      console.warn("math.block error:", e.message, "| input:", latex);
      return `<span style="color:red;font-family:monospace" title="${e.message}">${latex}</span>`;
    }
  }

  /**
   * Inline fraction shortcut: renders \frac{n}{d}.
   * n and d can be numbers or LaTeX expression strings.
   * @param {string|number} n - numerator (LaTeX)
   * @param {string|number} d - denominator (LaTeX)
   * @returns {string} HTML string
   */
  function frac(n, d) {
    return inline(`\\frac{${n}}{${d}}`);
  }

  /**
   * Build a LaTeX power string for base^exp, suppressing the trivial exponent 1.
   *   latexPow('x', 0)  → '1'
   *   latexPow('x', 1)  → 'x'        (no superscript shown)
   *   latexPow('x', 3)  → 'x^{3}'
   *   latexPow('ab', 2) → 'ab^{2}'
   *
   * Returns a LaTeX string (not rendered HTML). Pass the result into
   * math.inline() or embed it inside a larger LaTeX expression.
   *
   * @param {string|number} base - the base symbol (e.g. 'x', 'y', 'ab')
   * @param {number} exp - the exponent
   * @returns {string} LaTeX string
   */
  function latexPow(base, exp) {
    if (exp === 0) return "1";
    if (exp === 1) return String(base);
    return `${base}^{${exp}}`;
  }

  /**
   * Auto-render all delimited math in a DOM element.
   * Supports: $...$ (inline), $$...$$ (block), \(...\), \[...\]
   * Requires the KaTeX auto-render extension to also be loaded.
   * @param {Element} el - DOM element to scan and render in-place
   */
  function autoRender(el) {
    if (typeof renderMathInElement === "function") {
      renderMathInElement(el, {
        delimiters: [
          { left: "$$",  right: "$$",  display: true  },
          { left: "\\[", right: "\\]", display: true  },
          { left: "$",   right: "$",   display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
      });
    }
  }

  /* ── Math Utilities ──────────────────────────────────────────────────────── */

  /** Greatest common divisor (Euclidean algorithm) */
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    return b === 0 ? a : gcd(b, a % b);
  }

  /** Least common multiple */
  function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }

  /**
   * Reduce fraction n/d to lowest terms.
   * @returns {{ n: number, d: number }}
   */
  function reduce(n, d) {
    const g = gcd(Math.abs(n), Math.abs(d));
    return { n: n / g, d: d / g };
  }

  /* ── Randomization Utilities ─────────────────────────────────────────────── */

  /** Pick a random element from an array */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /** Random integer in [a, b] inclusive */
  function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

  /** Fisher-Yates shuffle — returns a new array, does not mutate the original */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */
  return { inline, block, frac, latexPow, autoRender, gcd, lcm, reduce, pick, randInt, shuffle };
})();
