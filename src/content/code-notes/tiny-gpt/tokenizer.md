---
workspace: tiny-gpt
noteId: tokenizer
title: Characters become addresses
file: data.py
order: 2
from: 'text = Path(__file__).with_name("input.txt").read_text(encoding="utf-8")'
to: 'return "".join(itos[index] for index in tokens)'
---

The vocabulary is just the sorted set of characters in [input.txt](#tiny-gpt/file/input.txt/1-12). `stoi` maps each character to an integer; `itos` reverses that mapping.

These IDs have no numerical meaning. A larger ID does not mean a more important character. It is an address into [the embedding table](#tiny-gpt/note/embeddings).

Unlike a subword tokenizer, this one uses **one token per character**. A character absent from the file raises a `KeyError`; our bundled text includes every character in `"Hello, "`.
