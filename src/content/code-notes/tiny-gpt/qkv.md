---
workspace: tiny-gpt
noteId: qkv
title: Three views of the same token
file: model.py
order: 5
from: "qkv = self.c_attn(x)"
to: "v = v.view(B, T, self.n_head, C // self.n_head).transpose(1, 2)"
---

One linear layer projects each token into three vectors. A **query** represents what this position is looking for; a **key** represents what a position offers for matching; a **value** carries the information that can be combined.

The split gives three tensors shaped `(B, T, C)`. Reshaping divides the channels across heads; transposing produces `(B, heads, T, head_size)`.

With this configuration, that is `(B, 1, T, 32)`. More heads divide the same embedding width, which is why the constructor checks that the width is divisible by the head count. Next: [how the vectors interact](#tiny-gpt/note/causal-attention).
