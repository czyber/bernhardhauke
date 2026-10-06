import assert from "node:assert/strict";
import { test } from "node:test";
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
