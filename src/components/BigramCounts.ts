import { LearningFigure } from "./LearningFigure";
import { countNameBigrams, drawNextCharacter } from "../lib/bigram-counts";

const styles = `<style>
.bigram{max-width:440px;margin-inline:auto}.training,.row-explanation{font:16px/1.6 var(--font-copy,Georgia,serif);color:var(--quiet)}.training strong{color:var(--ink);font-weight:normal}.matrix{text-align:center;margin:20px 0}.matrix caption{text-align:left;color:var(--quiet);padding-bottom:8px}.matrix th,.matrix td{width:25%;font-size:14px;font-variant-numeric:tabular-nums}.matrix thead th{color:var(--quiet)}.matrix tbody tr[data-active="true"]{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent)}.matrix button{width:44px;min-height:40px;padding:4px}.matrix tbody th{padding:4px}.probabilities{margin:14px 0 20px}.probability{display:grid;grid-template-columns:48px minmax(60px,1fr) 110px;gap:10px;align-items:center;margin:10px 0;font-variant-numeric:tabular-nums}.track{height:10px;background:var(--line);overflow:hidden}.fill{height:100%;background:var(--accent)}.probability output{text-align:right}.generation{padding-top:18px;border-top:1px solid var(--line)}.prefix{font-size:16px;overflow-wrap:anywhere}.prefix output{color:var(--accent)}.trace{min-height:44px;color:var(--quiet);margin-top:12px}.hint{margin-bottom:0}.probability-label{color:var(--quiet)}
:host([bare]) .training,:host([bare]) .row-explanation,:host([bare]) .matrix caption{display:none}:host([bare]) .matrix{margin-top:0}:host([bare]) .generation{padding-top:0;border-top:0}:host([bare]) .trace{position:absolute;width:1px;height:1px;min-height:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
</style>`;

class BigramCounts extends LearningFigure {
  protected setup() {
    const model = countNameBigrams(["ana", "anna"]);
    let current = model.boundary;
    let prefix = "";
    let complete = false;
    let message = "Start at the boundary, then draw a character using its row.";
    this.mount(
      `${styles}<div class="bigram">
      <p class="training">Training names: <strong>ana</strong> and <strong>anna</strong>. Count neighboring pairs in <strong>.ana.</strong> and <strong>.anna.</strong>; the dot marks each name’s start and end.</p>
      <table class="matrix"><caption>Current character ↓ · next character →</caption><thead><tr><th scope="col">Current</th>${model.characters.map((character) => `<th scope="col">${character}</th>`).join("")}</tr></thead><tbody>${model.characters.map((character, row) => `<tr data-count-row="${row}"><th scope="row"><button data-row="${row}" aria-label="Use the ${character === model.boundary ? "boundary" : character} row" aria-pressed="false">${character}</button></th>${model.counts[row].map((count) => `<td>${count}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p class="row-explanation" data-explanation></p>
      <div class="probabilities" role="group" aria-label="Next-character probabilities">${model.characters.map((character, index) => `<div class="probability"><span class="probability-label">${character === model.boundary ? ". end" : character}</span><div class="track" aria-hidden="true"><div class="fill" data-bar="${index}"></div></div><output data-probability="${index}" aria-label="Probability of ${character === model.boundary ? "ending the name" : character}"></output></div>`).join("")}</div>
      <div class="generation"><p class="prefix">Generated name: <output data-prefix></output></p><div class="controls"><button class="primary" data-draw>Draw next character</button><button data-reset>Reset</button></div><p class="trace" data-trace role="status" aria-live="polite"></p></div>
      <p class="hint">Choose a row to start a continuation from that character.</p>
      </div>`,
      "A two-name demonstration, separate from my September training runs. Counts become probabilities; each draw uses the row for the latest character.",
    );
    const update = () => {
      const row = model.characters.indexOf(current);
      this.root
        .querySelectorAll<HTMLElement>("[data-count-row]")
        .forEach((node) => {
          node.dataset.active = String(Number(node.dataset.countRow) === row);
        });
      this.root
        .querySelectorAll<HTMLButtonElement>("[data-row]")
        .forEach((button) => {
          button.setAttribute(
            "aria-pressed",
            String(Number(button.dataset.row) === row),
          );
        });
      const total = model.totals[row];
      const outcomes = model.characters.flatMap((character, index) => {
        const count = model.counts[row][index];
        return count
          ? [
              `${count}/${total} lead to ${character === model.boundary ? "the end" : character}`,
            ]
          : [];
      });
      this.find("[data-explanation]").textContent =
        `${current === model.boundary ? "At the start" : `After ${current}`}, ${outcomes.join(" and ")}. Divide each count by the row total to get its probability.`;
      model.probabilities[row].forEach((probability, index) => {
        this.find<HTMLElement>(`[data-bar="${index}"]`).style.width =
          `${probability * 100}%`;
        const percentage = Number((probability * 100).toFixed(1));
        this.find(`[data-probability="${index}"]`).textContent =
          `${model.counts[row][index]}/${total} = ${percentage}%`;
      });
      this.find("[data-prefix]").textContent = prefix || "(start)";
      this.find("[data-trace]").textContent = this.hasAttribute("bare")
        ? complete
          ? "Name complete."
          : current === model.boundary
            ? "Ready to start."
            : `Current character: ${current}.`
        : message;
      const drawButton = this.find<HTMLButtonElement>("[data-draw]");
      drawButton.disabled = complete;
      drawButton.textContent =
        this.hasAttribute("bare") && complete
          ? "Name complete"
          : "Draw next character";
    };
    const selectRow = (target: Element) => {
      const button = target.closest<HTMLButtonElement>("[data-row]");
      if (!button) return false;
      const character = model.characters[Number(button.dataset.row)];
      if (character !== current || complete) {
        current = character;
        prefix = character === model.boundary ? "" : character;
        complete = false;
        message =
          character === model.boundary
            ? "Start at the boundary, then draw a character using its row."
            : `Continue from ${character}. The next draw uses the ${character} row.`;
        update();
      }
      return true;
    };
    this.on("focusin", (event) => {
      if (event.target instanceof Element) selectRow(event.target);
    });
    this.on("click", (event) => {
      if (!(event.target instanceof Element) || selectRow(event.target)) return;
      if (event.target.closest("[data-reset]")) {
        current = model.boundary;
        prefix = "";
        complete = false;
        message = "Start at the boundary, then draw a character using its row.";
      } else if (event.target.closest("[data-draw]") && !complete) {
        const previous = current;
        current = drawNextCharacter(model, current, Math.random());
        complete = current === model.boundary;
        if (complete) {
          message = `Drew the end marker from the ${previous} row. The name is complete; reset to draw another.`;
        } else {
          prefix += current;
          message = `Drew ${current} from the ${previous === model.boundary ? "boundary" : previous} row. The next draw uses the ${current} row.`;
        }
      } else return;
      update();
    });
    update();
  }
}

if (!customElements.get("bigram-counts"))
  customElements.define("bigram-counts", BigramCounts);
