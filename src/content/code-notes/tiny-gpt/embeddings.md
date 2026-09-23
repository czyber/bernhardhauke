---
workspace: tiny-gpt
noteId: embeddings
title: What the character is, and where it is
file: model.py
order: 4
from: "pos = torch.arange(T, dtype=torch.long, device=idx.device)"
to: "x = pos_emb + tok_emb"
---

`wte` looks up a learned vector for each character ID: `(B, T)` becomes `(B, T, C)`. `wpe` looks up a learned vector for each position: `(T, C)`.

Adding them broadcasts the position vectors across the batch. Each position now carries both character and position information. At initialization these tables are random; training would give them useful structure.

Follow that tensor into [the transformer block](#tiny-gpt/note/residuals), which calls attention and the feed-forward network in sequence.
