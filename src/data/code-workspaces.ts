import model from "../../public/code/tiny-gpt/model.py?raw";
import data from "../../public/code/tiny-gpt/data.py?raw";
import sample from "../../public/code/tiny-gpt/sample.py?raw";
import input from "../../public/code/tiny-gpt/input.txt?raw";
import requirements from "../../public/code/tiny-gpt/requirements.txt?raw";
import type { WorkspaceDefinition } from "../lib/code-workspace";

export const codeWorkspaces: Record<string, WorkspaceDefinition> = {
  "tiny-gpt": {
    id: "tiny-gpt",
    title: "tiny-gpt",
    description: "A character-level transformer, explained in place.",
    initialFile: "model.py",
    initialNote: "config",
    files: [
      { path: "model.py", language: "python", source: model },
      { path: "data.py", language: "python", source: data },
      { path: "sample.py", language: "python", source: sample },
      { path: "input.txt", language: "plaintext", source: input },
      { path: "requirements.txt", language: "plaintext", source: requirements },
    ].map((file) => ({ ...file, downloadUrl: `/code/tiny-gpt/${file.path}` })),
  },
};
