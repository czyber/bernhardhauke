---
workspace: tiny-gpt
noteId: config
title: A whole model in five numbers
file: model.py
order: 1
from: "@dataclass"
to: "vocab_size: int = 65"
---

One transformer block, one attention head, **32 numbers per token**, and a context window of eight characters. Small enough to follow without losing the shape of the program.

`vocab_size` is the number of distinct characters, not the length of the text. The default is a placeholder: [the setup in sample.py](#tiny-gpt/note/setup) replaces it with the vocabulary built from `input.txt`.

Keep three dimensions in mind: **B** = sequences in a batch, **T** = positions in each sequence, **C** = embedding width. Most of the model carries a tensor shaped `(B, T, C)`.
