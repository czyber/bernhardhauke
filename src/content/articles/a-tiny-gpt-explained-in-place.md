---
title: "A tiny GPT, explained in place"
description: "The whole model, the real files, and the explanations right where they belong. An experiment in reading code."
pubDate: 2026-09-23
tags: [AI, PyTorch, Code walkthrough]
codeWorkspace: tiny-gpt
---

I find it hard to understand a program when I have to assemble it from snippets scattered through an article. I want to open the files, see what calls what, and keep the surrounding code in view.

So here is a small GPT as a project you can explore. The explanations live **inside the editor**, attached to the lines they describe. Open a note, follow a link to another part of the model, or work through the reading guide. The code stays intact.

This model starts with random weights. It shows the path from characters to next-character probabilities; it does not train or run in your browser. Download the files to try it locally.

## Seeing the causal mask

Every square below represents one entry in an **8 × 8** tensor. Rows are query positions; columns are key positions. A bright square allows attention. A dark square blocks it. Inspect row 3: it can attend to positions 0 through 3, including itself.

<tensor-pixels preset="causal-mask">
  <p>An 8 × 8 causal mask: entry [query, key] is 1 if key is less than or equal to query, otherwise 0. The lower triangle, including the diagonal, is active.</p>
</tensor-pixels>

For tensors with batch and head axes, explore [Tensors, one square at a time](/articles/tensors-one-square-at-a-time/). Then open the [causal attention note](#tiny-gpt/note/causal-attention) in the full project below.
