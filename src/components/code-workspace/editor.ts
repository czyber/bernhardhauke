import * as monaco from "monaco-editor/editor/editor.api.js";
import "monaco-editor-icons";
import "monaco-editor/editor/contrib/folding/browser/folding.js";
import "monaco-editor/editor/contrib/find/browser/findController.js";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard.js";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu.js";
import "monaco-editor/editor/contrib/links/browser/links.js";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching.js";
import "monaco-editor/languages/definitions/python/register.js";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import {
  fileHash,
  noteHash,
  parseCodeHash,
  type CodeNote,
  type CodeWorkspaceData,
} from "../../lib/code-workspace";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };

monaco.editor.defineTheme("article-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "879184", fontStyle: "italic" },
    { token: "keyword", foreground: "C4A4D9" },
    { token: "string", foreground: "D3B48C" },
    { token: "number", foreground: "AFCAA3" },
    { token: "type.identifier", foreground: "83C6C4" },
  ],
  colors: {
    "editor.background": "#202020",
    "editor.foreground": "#DCDAD5",
    "editorLineNumber.foreground": "#74746E",
    "editorLineNumber.activeForeground": "#DCDAD5",
    "editor.lineHighlightBackground": "#FFFFFF04",
    "editor.selectionBackground": "#6C514E88",
    "editor.inactiveSelectionBackground": "#6C514E44",
    "editorGutter.background": "#202020",
    "editorWidget.background": "#282725",
    "editorWidget.border": "#51443D",
    focusBorder: "#C59178",
    "editorCursor.foreground": "#C59178",
  },
});

interface NoteZone {
  id: string;
  note: CodeNote;
  definition: monaco.editor.IViewZone;
  card: HTMLDetailsElement;
  observer: ResizeObserver;
}

export async function initializeWorkspace(root: HTMLElement) {
  if (root.dataset.ready) return;
  const data = JSON.parse(
    root.querySelector("[data-workspace-data]")!.textContent!,
  ) as CodeWorkspaceData;
  const get = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const workbench = get(".cw-workbench");
  const container = get(".cw-editor");
  const fallback = get(".cw-fallback");
  const announcement = get(".cw-announcement");
  const models = new Map(
    data.files.map((file) => [
      file.path,
      monaco.editor.createModel(
        file.source.trimEnd() + "\n",
        file.language,
        monaco.Uri.from({
          scheme: "article",
          authority: data.id,
          path: `/${file.path}`,
        }),
      ),
    ]),
  );
  const views = new Map<string, monaco.editor.ICodeEditorViewState>();
  const openedNotes = new Set<string>(
    data.initialNote ? [data.initialNote] : [],
  );
  let currentFile = data.initialFile;
  let activeNote = data.notes.find((note) => note.id === data.initialNote);
  let notesVisible = true;
  let zones: NoteZone[] = [];
  let disposed = false;
  let layoutFrame = 0;
  let noticeTimer = 0;
  let pendingReveal: { note: CodeNote; focus: boolean } | undefined;
  const events = new AbortController();

  workbench.hidden = false;
  const editor = monaco.editor.create(container, {
    model: models.get(currentFile),
    theme: "article-dark",
    readOnly: true,
    domReadOnly: true,
    ariaLabel: `${currentFile}, read-only source code. Use Tab to leave the editor.`,
    automaticLayout: true,
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    fontSize: 13,
    lineHeight: 22,
    fontLigatures: false,
    minimap: { enabled: false },
    glyphMargin: true,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    smoothScrolling: false,
    folding: true,
    showFoldingControls: "always",
    foldingStrategy: "indentation",
    stickyScroll: { enabled: false },
    renderLineHighlight: "none",
    padding: { top: 16, bottom: 24 },
    overviewRulerBorder: false,
    scrollbar: {
      alwaysConsumeMouseWheel: false,
      verticalScrollbarSize: 9,
      horizontalScrollbarSize: 9,
    },
    guides: { indentation: true, highlightActiveIndentation: false },
    contextmenu: true,
    links: true,
    selectionHighlight: false,
    occurrencesHighlight: "off",
    wordWrap: "off",
    tabIndex: 0,
  });
  // A reading surface should let keyboard users Tab directly to its controls.
  editor.updateOptions({ tabFocusMode: true });
  // Monaco hides view zones by default; these zones contain authored reading content.
  container.querySelector(".view-zones")?.removeAttribute("aria-hidden");
  const decorations = editor.createDecorationsCollection();
  const subscriptions: monaco.IDisposable[] = [];

  function announce(message: string) {
    window.clearTimeout(noticeTimer);
    announcement.textContent = message;
    noticeTimer = window.setTimeout(() => {
      announcement.textContent = "";
    }, 4000);
  }

  function updateChrome() {
    const file = data.files.find((file) => file.path === currentFile)!;
    const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    for (const button of root.querySelectorAll<HTMLElement>("[data-file]")) {
      const active = button.dataset.file === currentFile;
      button.classList.toggle("is-active", active);
      if (button.getAttribute("role") === "tab") {
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        if (active) container.setAttribute("aria-labelledby", button.id);
      } else if (active) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    const selectedTab = tabs.find((tab) => tab.dataset.file === currentFile);
    const tablist = get(".cw-tabs");
    if (selectedTab) {
      const left = selectedTab.offsetLeft - tablist.offsetLeft;
      if (left < tablist.scrollLeft) tablist.scrollLeft = left;
      else if (
        left + selectedTab.offsetWidth >
        tablist.scrollLeft + tablist.clientWidth
      )
        tablist.scrollLeft =
          left + selectedTab.offsetWidth - tablist.clientWidth;
    }
    get("[data-breadcrumb]").textContent = `${data.title} / ${currentFile}`;
    get("[data-language]").textContent =
      file.language === "python" ? "Python" : "Plain text";
    get<HTMLAnchorElement>("[data-download]").href = file.downloadUrl;
    get("[data-download]").setAttribute(
      "aria-label",
      `Download ${currentFile}`,
    );
    editor.updateOptions({
      ariaLabel: `${currentFile}, read-only source code. Use Tab to leave the editor.`,
    });
    get('[data-action="notes"]').setAttribute(
      "aria-pressed",
      String(notesVisible),
    );
    for (const link of root.querySelectorAll("[data-note-link]")) {
      const active = link.getAttribute("data-note-link") === activeNote?.id;
      if (active) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    }
    const index = data.notes.findIndex((note) => note.id === activeNote?.id);
    get("[data-reading-position]").textContent =
      index >= 0
        ? `Note ${String(index + 1).padStart(2, "0")} / ${String(data.notes.length).padStart(2, "0")} · ${activeNote!.title}`
        : "Explore the code";
    get<HTMLButtonElement>('[data-action="previous"]').disabled = index <= 0;
    get<HTMLButtonElement>('[data-action="next"]').disabled =
      index >= data.notes.length - 1;
  }

  function updateDecorations() {
    decorations.set(
      notesVisible
        ? data.notes
            .filter((note) => note.file === currentFile)
            .map((note) => ({
              range: new monaco.Range(note.startLine, 1, note.endLine, 1),
              options: {
                isWholeLine: true,
                className:
                  note.id === activeNote?.id && openedNotes.has(note.id)
                    ? "cw-annotated-range"
                    : undefined,
                linesDecorationsClassName: "cw-note-range-marker",
                glyphMarginClassName: "cw-note-glyph",
                glyphMarginHoverMessage: {
                  value: `**${note.title}**\n\nClick to open the author's explanation.`,
                },
                overviewRuler: {
                  color: "#C5917870",
                  position: monaco.editor.OverviewRulerLane.Right,
                },
              },
            }))
        : [],
    );
  }

  function scheduleZoneLayout() {
    if (disposed || layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      const width = Math.max(100, editor.getLayoutInfo().contentWidth - 22);
      for (const zone of zones) {
        zone.card.style.width = `${width}px`;
        zone.card.style.transform = `translateX(${editor.getScrollLeft()}px)`;
      }
      editor.changeViewZones((accessor) => {
        for (const zone of zones) {
          const measured = zone.card.getBoundingClientRect().height;
          // Off-screen zones are display:none. Keep their last known height.
          if (!measured) continue;
          const height = Math.ceil(measured) + 12;
          if (zone.definition.heightInPx !== height) {
            zone.definition.heightInPx = height;
            accessor.layoutZone(zone.id);
          }
        }
      });
      const reveal = pendingReveal;
      const zone = zones.find((zone) => zone.note.id === reveal?.note.id);
      if (reveal && zone?.card.getBoundingClientRect().height) {
        pendingReveal = undefined;
        editor.setScrollTop(
          Math.max(0, editor.getTopForLineNumber(reveal.note.endLine) - 110),
        );
        if (reveal.focus)
          zone.card.querySelector("summary")?.focus({ preventScroll: true });
      }
    });
  }

  function removeZones() {
    editor.changeViewZones((accessor) => {
      for (const zone of zones) {
        zone.observer.disconnect();
        accessor.removeZone(zone.id);
      }
    });
    zones = [];
  }

  function buildZones() {
    removeZones();
    if (!notesVisible) {
      updateDecorations();
      return;
    }
    editor.changeViewZones((accessor) => {
      data.notes
        .filter((note) => note.file === currentFile)
        .forEach((note, index) => {
          const domNode = document.createElement("div");
          domNode.className = "cw-note-zone";
          // Let links, text selection, and native details controls own their input.
          domNode.addEventListener("mousedown", (event) =>
            event.stopPropagation(),
          );
          domNode.addEventListener("pointerdown", (event) =>
            event.stopPropagation(),
          );
          const card = document.createElement("details");
          card.className = "cw-inline-note";
          card.dataset.noteId = note.id;
          card.open = openedNotes.has(note.id);
          card.style.width = `${Math.max(100, editor.getLayoutInfo().contentWidth - 22)}px`;
          const summary = document.createElement("summary");
          const title = document.createElement("span");
          title.className = "cw-note-title";
          title.textContent = note.title;
          const range = document.createElement("span");
          range.className = "cw-note-lines";
          range.textContent =
            note.startLine === note.endLine
              ? `L${note.startLine}`
              : `L${note.startLine}–${note.endLine}`;
          summary.append(title, range);
          const body = document.createElement("div");
          body.className = "cw-note-body";
          // Only repository-authored Markdown, rendered by Astro at build time.
          body.innerHTML = note.html;
          const footer = document.createElement("div");
          footer.className = "cw-note-footer";
          const permalink = document.createElement("button");
          permalink.type = "button";
          permalink.textContent = "Copy link";
          permalink.setAttribute("aria-label", `Copy link to ${note.title}`);
          permalink.addEventListener("click", async () => {
            const url = new URL(window.location.href);
            url.hash = noteHash(data.id, note.id);
            await copy(url.href, "Link copied");
          });
          const label = document.createElement("span");
          label.textContent = "AUTHOR’S NOTE";
          footer.append(label, permalink);
          card.append(summary, body, footer);
          domNode.append(card);
          const definition: monaco.editor.IViewZone = {
            afterLineNumber: note.endLine,
            heightInPx: 44,
            domNode,
            ordinal: index,
            suppressMouseDown: false,
          };
          const id = accessor.addZone(definition);
          const observer = new ResizeObserver(scheduleZoneLayout);
          observer.observe(card);
          zones.push({ id, note, definition, card, observer });
          card.addEventListener("toggle", () => {
            if (card.open === openedNotes.has(note.id)) return;
            if (card.open) {
              openedNotes.add(note.id);
              activeNote = note;
            } else openedNotes.delete(note.id);
            updateChrome();
            updateDecorations();
            scheduleZoneLayout();
          });
        });
    });
    scheduleZoneLayout();
    updateDecorations();
  }

  function selectFile(path: string) {
    if (!models.has(path)) return false;
    if (path !== currentFile) {
      pendingReveal = undefined;
      const view = editor.saveViewState();
      if (view) views.set(currentFile, view);
      removeZones();
      currentFile = path;
      editor.setModel(models.get(path)!);
      buildZones();
      const saved = views.get(path);
      if (saved) editor.restoreViewState(saved);
    }
    root.classList.remove("cw-explorer-open");
    get('[data-action="explorer"]').setAttribute("aria-expanded", "false");
    updateChrome();
    return true;
  }

  function setHash(hash: string) {
    if (window.location.hash !== hash) history.pushState(null, "", hash);
  }

  async function openNote(note: CodeNote, changeHash = true, focus = true) {
    activeNote = note;
    openedNotes.add(note.id);
    if (!notesVisible) {
      notesVisible = true;
      buildZones();
    }
    selectFile(note.file);
    const zone = zones.find((zone) => zone.note.id === note.id);
    if (zone) zone.card.open = true;
    editor.trigger("article", "editor.unfold", {
      levels: 99,
      direction: "up",
      selectionLines: [note.startLine - 1, note.endLine - 1],
    });
    editor.setPosition({ lineNumber: note.startLine, column: 1 });
    pendingReveal = { note, focus };
    updateChrome();
    updateDecorations();
    scheduleZoneLayout();
    if (changeHash) setHash(noteHash(data.id, note.id));
    // Bring the zone into view for measurement, then align it after its height updates.
    editor.setScrollTop(
      Math.max(0, editor.getTopForLineNumber(note.endLine) - 110),
    );
  }

  async function followHash(focus = true) {
    const target = parseCodeHash(location.hash, data.id);
    if (!target) return false;
    if (target.kind === "note") {
      const note = data.notes.find((note) => note.id === target.id);
      if (!note) return false;
      await openNote(note, false, focus);
    } else {
      const model = models.get(target.file);
      if (!model || target.endLine > model.getLineCount()) return false;
      selectFile(target.file);
      editor.trigger("article", "editor.unfold", {
        levels: 99,
        direction: "up",
        selectionLines: [target.startLine - 1, target.endLine - 1],
      });
      const range = new monaco.Range(
        target.startLine,
        1,
        target.endLine,
        model.getLineMaxColumn(target.endLine),
      );
      editor.setSelection(range);
      editor.revealRangeNearTop(range);
      if (focus) editor.focus();
    }
    return true;
  }

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      announce(message);
    } catch {
      announce(
        "Clipboard unavailable. Select the source to copy it, or download the file.",
      );
    }
  }

  root.addEventListener(
    "click",
    async (event) => {
      const target = event.target as HTMLElement;
      const link = target.closest<HTMLAnchorElement>('a[href^="#"]');
      if (
        link &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        !fallback.contains(link)
      ) {
        const hash = link.getAttribute("href")!;
        if (parseCodeHash(hash, data.id)) {
          event.preventDefault();
          setHash(hash);
          await followHash();
          return;
        }
      }
      const fileButton = target.closest<HTMLElement>("[data-file]");
      if (fileButton) {
        selectFile(fileButton.dataset.file!);
        setHash(fileHash(data.id, currentFile));
        return;
      }
      const button = target.closest<HTMLElement>("[data-action]");
      if (!button) return;
      switch (button.dataset.action) {
        case "previous":
        case "next": {
          const index = data.notes.findIndex(
            (note) => note.id === activeNote?.id,
          );
          const note =
            data.notes[index + (button.dataset.action === "next" ? 1 : -1)];
          if (note) await openNote(note);
          break;
        }
        case "notes":
          notesVisible = !notesVisible;
          buildZones();
          updateChrome();
          break;
        case "find":
          editor.focus();
          await editor.getAction("actions.find")?.run();
          break;
        case "wrap": {
          const wrap = button.getAttribute("aria-pressed") !== "true";
          button.setAttribute("aria-pressed", String(wrap));
          editor.updateOptions({ wordWrap: wrap ? "on" : "off" });
          break;
        }
        case "copy":
          await copy(
            models.get(currentFile)!.getValue(),
            `${currentFile} copied`,
          );
          break;
        case "explorer": {
          const open = root.classList.toggle("cw-explorer-open");
          button.setAttribute("aria-expanded", String(open));
          break;
        }
        case "fullscreen": {
          if (document.fullscreenElement === root)
            await document.exitFullscreen();
          else if (root.requestFullscreen) {
            try {
              await root.requestFullscreen();
            } catch {
              announce("Full screen is unavailable in this browser.");
            }
          } else announce("Full screen is unavailable in this browser.");
          break;
        }
        case "plain": {
          fallback.hidden = !fallback.hidden;
          workbench.hidden = !fallback.hidden;
          button.textContent = fallback.hidden
            ? "Plain reading view"
            : "Back to editor";
          if (fallback.hidden) editor.layout();
          break;
        }
      }
    },
    { signal: events.signal, capture: true },
  );

  get(".cw-tabs").addEventListener(
    "keydown",
    (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      const tabs = [
        ...root.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      ];
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      tabs[next].click();
      tabs[next].focus({ preventScroll: true });
    },
    { signal: events.signal },
  );

  window.addEventListener(
    "hashchange",
    () => {
      void followHash();
    },
    { signal: events.signal },
  );
  window.addEventListener(
    "popstate",
    () => {
      void followHash();
    },
    { signal: events.signal },
  );
  document.addEventListener(
    "fullscreenchange",
    () => {
      const expanded = document.fullscreenElement === root;
      get('[data-action="fullscreen"]').setAttribute(
        "aria-label",
        expanded ? "Exit expanded editor" : "Expand editor",
      );
      editor.layout();
      scheduleZoneLayout();
    },
    { signal: events.signal },
  );
  subscriptions.push(
    editor.onDidLayoutChange(scheduleZoneLayout),
    editor.onDidScrollChange(scheduleZoneLayout),
    editor.onDidContentSizeChange(scheduleZoneLayout),
  );
  subscriptions.push(
    editor.onDidChangeCursorPosition((event) => {
      get("[data-location]").textContent =
        `Ln ${event.position.lineNumber}, Col ${event.position.column}`;
    }),
  );
  subscriptions.push(
    editor.onMouseDown((event) => {
      if (
        event.target.type !==
          monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        !event.target.position
      )
        return;
      const line = event.target.position.lineNumber;
      const note = data.notes.find(
        (note) =>
          note.file === currentFile &&
          note.startLine <= line &&
          note.endLine >= line,
      );
      if (note && notesVisible) void openNote(note);
    }),
  );
  editor.addAction({
    id: "article.copy-line-link",
    label: "Copy link to selected lines",
    contextMenuGroupId: "9_article",
    contextMenuOrder: 1,
    run: async () => {
      const selection = editor.getSelection();
      if (!selection) return;
      const end =
        selection.endColumn === 1 &&
        selection.endLineNumber > selection.startLineNumber
          ? selection.endLineNumber - 1
          : selection.endLineNumber;
      const url = new URL(location.href);
      url.hash = fileHash(data.id, currentFile, selection.startLineNumber, end);
      await copy(url.href, "Link to selected lines copied");
    },
  });

  fallback.hidden = true;
  get('[data-action="plain"]').hidden = false;
  get("[data-loading]").hidden = true;
  root.dataset.ready = "true";
  buildZones();
  updateChrome();
  if (await followHash(false)) {
    // The browser may have scrolled to the much taller plain-text fallback.
    // Re-anchor the project after replacing it, including in longer articles.
    root.scrollIntoView({ block: "start", behavior: "instant" });
  } else if (activeNote) {
    await openNote(activeNote, false, false);
  }

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    events.abort();
    cancelAnimationFrame(layoutFrame);
    clearTimeout(noticeTimer);
    removeZones();
    subscriptions.forEach((subscription) => subscription.dispose());
    decorations.clear();
    editor.dispose();
    models.forEach((model) => model.dispose());
  };
  window.addEventListener(
    "pagehide",
    (event) => {
      if (!event.persisted) cleanup();
    },
    { once: true },
  );
  document.addEventListener("astro:before-swap", cleanup, { once: true });
}
