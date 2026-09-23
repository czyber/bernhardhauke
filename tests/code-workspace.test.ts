import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";
import {
  fileHash,
  noteHash,
  parseCodeHash,
  resolveNoteRange,
} from "../src/lib/code-workspace.ts";

test("source anchors follow code when lines are inserted above a note", () => {
  const source = "import torch\n\nclass GPT:\n    pass\n";
  const location = { file: "model.py", from: "class GPT:", to: "pass" };
  assert.deepEqual(resolveNoteRange(source, location), {
    startLine: 3,
    endLine: 4,
  });
  assert.deepEqual(resolveNoteRange("# Introduction\n" + source, location), {
    startLine: 4,
    endLine: 5,
  });
});

test("missing, ambiguous, reversed and out-of-file note ranges fail loudly", () => {
  const source = "first\nrepeat\nrepeat\nlast";
  for (const location of [
    { from: "missing" },
    { from: "repeat" },
    { from: "last", to: "first" },
    { startLine: 0 },
    { startLine: 1, endLine: 5 },
    { startLine: 1.5 },
  ])
    assert.throws(() =>
      resolveNoteRange(source, { file: "test.py", ...location }),
    );
  assert.deepEqual(
    resolveNoteRange(source, { file: "test.py", startLine: 2, endLine: 3 }),
    { startLine: 2, endLine: 3 },
  );
  assert.deepEqual(
    resolveNoteRange(source, { file: "test.py", from: "first" }),
    { startLine: 1, endLine: 1 },
  );
});

test("share links round-trip nested paths, Unicode and line ranges", () => {
  assert.deepEqual(
    parseCodeHash(fileHash("demo", "src/my model/α.py", 10, 20), "demo"),
    {
      kind: "file",
      file: "src/my model/α.py",
      startLine: 10,
      endLine: 20,
    },
  );
  assert.deepEqual(parseCodeHash(noteHash("demo", "attention"), "demo"), {
    kind: "note",
    id: "attention",
  });
});

test("unrelated or malformed deep links are ignored", () => {
  for (const hash of [
    "#heading",
    "#other/note/attention",
    "#demo/note/%ZZ",
    "#demo/file/x/0-1",
    "#demo/file/x/3-2",
    "#demo/file/x/1-2/extra",
    "#demo/note/x/extra",
    "#demo/file/x/1-9999999999999999999",
  ])
    assert.equal(parseCodeHash(hash, "demo"), null);
});

test("every showcase note and cross-reference points to existing source", () => {
  const dir = new URL("../src/content/code-notes/tiny-gpt/", import.meta.url);
  const notes = readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const text = readFileSync(new URL(name, dir), "utf8");
      const [, frontmatter, body] = text.split("---");
      return { ...parse(frontmatter), body };
    });
  const ids = new Set(notes.map((note) => note.noteId));
  assert.equal(ids.size, notes.length, "Note IDs must be unique");
  const source = (file: string) =>
    readFileSync(
      new URL(`../public/code/tiny-gpt/${file}`, import.meta.url),
      "utf8",
    );
  for (const note of notes) {
    resolveNoteRange(source(note.file), note);
    for (const [, hash] of note.body.matchAll(/\]\((#tiny-gpt\/[^)]+)\)/g)) {
      const target = parseCodeHash(hash, "tiny-gpt");
      assert.ok(target, `Invalid link: ${hash}`);
      if (target.kind === "note")
        assert.ok(ids.has(target.id), `Missing note: ${target.id}`);
      else resolveNoteRange(source(target.file), target);
    }
  }
});
