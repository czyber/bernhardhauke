export interface WorkspaceFile {
  path: string;
  language: string;
  source: string;
  downloadUrl: string;
}

export interface WorkspaceDefinition {
  id: string;
  title: string;
  description: string;
  initialFile: string;
  initialNote?: string;
  files: WorkspaceFile[];
}

export interface NoteLocation {
  file: string;
  from?: string;
  to?: string;
  startLine?: number;
  endLine?: number;
}

export interface CodeNote {
  id: string;
  title: string;
  file: string;
  startLine: number;
  endLine: number;
  html: string;
}

export interface CodeWorkspaceData extends WorkspaceDefinition {
  notes: CodeNote[];
}

/** Resolve exact, unique source lines at build time so notes survive edits above them. */
export function resolveNoteRange(source: string, location: NoteLocation) {
  const lines = source.trimEnd().split(/\r?\n/);
  const find = (anchor: string) => {
    const matches = lines.flatMap((line, index) =>
      line.trim() === anchor.trim() ? [index + 1] : [],
    );
    if (matches.length !== 1) {
      throw new Error(
        `Note anchor in ${location.file} must match exactly one line (${matches.length} matches): ${anchor}`,
      );
    }
    return matches[0];
  };
  const startLine = location.from ? find(location.from) : location.startLine;
  const endLine = location.to
    ? find(location.to)
    : (location.endLine ?? startLine);
  if (
    !Number.isInteger(startLine) ||
    !Number.isInteger(endLine) ||
    startLine! < 1 ||
    endLine! < startLine! ||
    endLine! > lines.length
  ) {
    throw new Error(
      `Invalid note range in ${location.file}: ${startLine}–${endLine}`,
    );
  }
  return { startLine: startLine!, endLine: endLine! };
}

export function noteHash(workspace: string, note: string) {
  return `#${encodeURIComponent(workspace)}/note/${encodeURIComponent(note)}`;
}

export function fileHash(
  workspace: string,
  file: string,
  startLine = 1,
  endLine = startLine,
) {
  return `#${encodeURIComponent(workspace)}/file/${encodeURIComponent(file)}/${startLine}-${endLine}`;
}

export function parseCodeHash(hash: string, workspace: string) {
  try {
    const [id, kind, target, range, ...extra] = hash
      .slice(1)
      .split("/")
      .map(decodeURIComponent);
    if (id !== workspace || !target || extra.length) return null;
    if (kind === "note" && !range) return { kind: "note" as const, id: target };
    if (kind !== "file" || !/^\d+-\d+$/.test(range ?? "")) return null;
    const [startLine, endLine] = range.split("-").map(Number);
    if (startLine < 1 || endLine < startLine || !Number.isSafeInteger(endLine))
      return null;
    return { kind: "file" as const, file: target, startLine, endLine };
  } catch {
    return null;
  }
}
