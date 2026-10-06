# Articles with an annotated code explorer

The code explorer uses Monaco, the editor behind VS Code, with read-only source
files and author-written Markdown
notes inserted as collapsible view zones. Readers can browse files, fold code,
search, select and copy text, download source, and follow links between notes.
There are no visitor comments, private drafts, or browser execution of the code.

## Add a project

1. Put the actual source files in `public/code/<project>/`. These same files are
   imported as text for the editor and served as downloads; keep one source of truth.
2. Register the project in `src/data/code-workspaces.ts`. Each file has a `path`,
   `language`, `source` imported with `?raw`, and `downloadUrl`. Set `initialFile`
   and, optionally, `initialNote` to choose the first explanation to open.
3. Add `codeWorkspace: <project>` to an article's frontmatter. Its Markdown becomes
   the introduction, followed by the full-width explorer.
4. Add the notes in `src/content/code-notes/<project>/` as individual `.md` files.

Python highlighting is bundled; `plaintext` also works. For a
new language, register its Monaco definition in
`src/components/code-workspace/editor.ts` and set the corresponding `language` in
the manifest. The editor loads only when a workspace nears the viewport.

## Write a note

```md
---
workspace: tiny-gpt
noteId: attention
title: Look back. Never ahead.
file: model.py
order: 6
from: "y = F.scaled_dot_product_attention(q, k, v, is_causal=True)"
to: "y = self.c_proj(y)"
---

**Causal attention** prevents a position from seeing future characters.

Follow [the shifted targets](#tiny-gpt/note/batches) to see why this matters.
```

`from` and `to` are exact source lines with surrounding indentation ignored.
Each must match **one** line in the file. They are resolved during the build, so
inserting code above a note keeps the note attached to the same code. A missing
or ambiguous anchor fails the build instead of silently annotating different code.
Omit `to` for a single-line note.

For repeated lines, use `startLine: 28` and `endLine: 32` instead. These ranges are
one-based and inclusive, and the build checks their bounds. Numeric ranges must
be updated manually when the file changes.

`order` controls the reading guide and Previous/Next navigation. Inline notes
appear after the last line of their annotated range, regardless of guide order.
Note IDs must be unique within their workspace. Use stable IDs for shared links.

The body supports Markdown paragraphs, lists, emphasis, inline code, code fences,
tables, images, and links. This is trusted, repository-authored content, like the
rest of the blog. It is rendered at build time and never mixed into the code file.

## Link to code

```md
[An explanation](#tiny-gpt/note/causal-attention)
[Lines in another file](#tiny-gpt/file/data.py/34-36)
[A single line](#tiny-gpt/file/model.py/33-33)
[Another article](/articles/the-loop-sampling-and-stopping/)
```

For nested file paths, percent-encode the path, for example `src%2Fmodel.py`.
Prefer links to note IDs when possible, because their source anchors survive
line insertions. A link from another page includes the article path before `#`.
Readers can use **Copy link** inside a note, or right-click selected source and
choose **Copy link to selected lines**. Browser Back/Forward restores code links.

## Reader controls and fallback

- **Notes** hides or restores the inline explanations.
- **Find**, **Wrap**, **Copy**, and **Download** work on the current file.
- **Expand** opens a larger reading surface; Escape exits.
- Tabs support arrow keys, Home, and End; Tab leaves the read-only editor.
- On small screens, the files button opens the explorer and reading guide.
- **Plain reading view** exposes server-rendered source and notes. This is also
  available when JavaScript is disabled or the editor cannot load.

## Checks

```sh
npm test
npm run build
python3 -m unittest discover -s tests -p 'test_*.py'
```

`npm test` checks source anchors and share links without needing PyTorch.
Source ranges and workspace references are also validated when an article's
code explorer is built. The optional Python checks compare tensor operations
and their generated code with PyTorch.
