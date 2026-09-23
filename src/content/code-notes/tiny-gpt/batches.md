---
workspace: tiny-gpt
noteId: batches
title: The answer is one position to the right
file: data.py
order: 3
from: "ix = torch.randint(len(source) - block_size, (batch_size,))"
to: "return x.to(device), y.to(device)"
---

Each row of `x` is a window of eight characters. The corresponding row of `y` is the same window shifted one character forward.

| Position | 1   | 2   | 3   | 4   |
| -------- | --- | --- | --- | --- |
| Input    | H   | e   | l   | l   |
| Target   | e   | l   | l   | o   |

Both tensors have shape `(B, T)`. The model predicts a next character at **every position**, so a batch supplies `B × T` training targets. [The loss](#tiny-gpt/note/loss) compares those targets with the vocabulary scores.
