import type katex from "katex";

let renderer: typeof katex | undefined;
let css = "";
let pending: Promise<void> | undefined;
export const escapeHTML = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export const mathReady = () => Boolean(renderer);
export const mathStyles = () => css;
export function loadTensorMath() {
  return (pending ??= Promise.all([
    import("katex"),
    import("katex/dist/katex.min.css?inline"),
  ]).then(([module, styles]) => {
    renderer = module.default;
    css = styles.default;
    // Font faces must live in the document; the layout rules belong in each
    // shadow root so article styles cannot distort the equations.
    const fonts = document.createElement("style");
    fonts.dataset.tensorMathFonts = "";
    fonts.textContent = (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).join("\n");
    document.head.append(fonts);
  }));
}
export function latex(source: string) {
  if (!renderer) return escapeHTML(source);
  return renderer.renderToString(source, {
    throwOnError: true,
    trust: false,
    strict: "error",
    maxSize: 10,
    maxExpand: 1000,
    output: "htmlAndMathml",
  });
}
/** Plain prose stays escaped; only explicitly delimited math is interpreted. */
export function mathText(source: string) {
  return source
    .split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g)
    .map((part) => {
      if (part.startsWith("$$") && part.endsWith("$$"))
        return latex(`\\displaystyle ${part.slice(2, -2)}`);
      if (part.startsWith("$") && part.endsWith("$"))
        return latex(part.slice(1, -1));
      return escapeHTML(part);
    })
    .join("");
}
