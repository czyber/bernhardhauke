---
title: "Your words are not what the model sees"
description: "Part one of a tour from prompt to model: how tokenizers turn text into token IDs, why character counting is awkward, and how IDs become vectors."
pubDate: 2026-07-31
tags:
  - AI
  - LLMs
  - Foundations
draft: false
---

_This is Part 1 of a multipart series about the components that stand between the words you type and the model weights that produce a response._

You brainstorm with ChatGPT, you code with Codex, Claude Code or any other coding agent. You enter a prompt, it takes some time until the first character of the response appears on your screen - but suddenly, they are flowing in at high speed.

Models shake up the research world, build websites and small projects that would take you days or weeks, in minutes or hours. Yet, by nature, they fail at creating large scale software, or even tell you how many r's are in the word “strawberry”.
LLMs not being “smart” and just _guessing_ the next token, how can we have things such as tool calls or structured response output? Wait, isn’t the model just a bunch of weights? How can I have a conversation with a file full of numbers?

> Something stands between you and the weights. In fact, quite a few things do.

This series will untangle the often overlooked pieces.

## You cannot talk to a file

You downloaded it. The weights! A bunch of numbers in a file - the "model," right? Now what?

You cannot talk with a file. You cannot ask it what to cook for dinner. Even if you could somehow magically send text into it, the model would not understand that text. Its layers operate on numbers: numbers in, numbers out.

Before the model can do anything useful, your prompt has to change shape.

<figure class="prose-figure--diagram">
  <img
    class="prose-figure--diagram-light"
    src="/articles/your-words-are-not-what-the-model-sees/tokenizer-light.png"
    alt="Diagram showing strawberry entering a tokenizer made from an algorithm, vocab.json, and merge.txt, then producing the token IDs 302, 1618, and 19772"
  />
  <img
    class="prose-figure--diagram-dark"
    src="/articles/your-words-are-not-what-the-model-sees/tokenizer.png"
    alt="Diagram showing strawberry entering a tokenizer made from an algorithm, vocab.json, and merge.txt, then producing the token IDs 302, 1618, and 19772"
  />
</figure>

## Tokens are chunks, not words

A token is not necessarily a character, syllable, or word. It is better to think of it as a chunk: a slice of text with an arbitrary length. As a rough rule of thumb, a token is around four characters of common English text, but there are exceptions everywhere.

Common text often becomes a single token. Less common text might be split into several. Spaces can be part of a token, and the same word can be encoded differently depending on whether it appears at the beginning of a sentence or after a space.

For one current OpenAI tokenizer, `o200k_base`, the word `strawberry` is split like this:

```text
"strawberry"
      ↓
["st", "raw", "berry"]
      ↓
[302, 1618, 19772]
```

Those boundaries and IDs are not universal. Another tokenizer can split the same word differently.

This sounds like a mundane preprocessing step, but the way your words are split has consequences you have almost certainly encountered.

This brings us to the first necessary component that is not in the weights themselves: the **tokenizer**.

## The tokenizer

A tokenizer consists of an algorithm and learned data. For a byte-pair encoding tokenizer, that data is essentially two things.

The first is a **vocabulary**: a large lookup table that assigns an integer ID to every token.

```json
{
  "!": 0,
  "\"": 1,
  "hello": 31373,
  "berry": 8396,
  "Ġthe": 262
}
```

The `Ġ` is how some tokenizers, such as GPT-2's, make a leading space visible. In that vocabulary, `" the"` is a different token from `"the"`.

The second is a ranked set of **merge rules**. These describe how small pieces can be combined into larger, more common chunks.

```text
Ġ t
h e
Ġ a
i n
Ġt he
```

Each line says: merge these two pieces into one. Their order determines their priority.

Take the word `configure`. With `o200k_base`, the entire word is one token. That result can be traced back to the learned merges - at some point, the pieces `config` and `ure` are combined into `configure`.

```text
config + ure → configure
```

The exact representation differs between model families. The vocabulary and merge rules might live in separate files, a single `tokenizer.json`, or a compact binary format such as `.tiktoken`. The principle is the same: the model and tokenizer are a pair. Change the tokenizer and the same text can turn into completely different IDs.

The last missing piece of the tokenizer is the **algorithm**. The tokenizer used in models like GPT or Llama is the Byte-Pair-Encoding (BPE) tokenizer. First it splits the text into the smallest units - individual characters. `berry -> b e r r y`. Now it looks at all adjacent pairs and searches for the highest priority **merge rule** for that pair and merges them. It repeats that process until non apply anymore.

```txt
"berry"  →  b e r r y
          →  b e rr y      (apply "r r")
          →  be rr y       (apply "b e")
          →  berry         (apply "be rry")
```

If the `"b e"` rule would not exist, you would end up with three tokens instead: `be rr y`.

## Why "strawberry" is awkward

The famous strawberry problem follows from this architecture. The model does not receive the word as the explicit sequence:

```text
s t r a w b e r r y
```

It receives three token IDs. Those IDs refer to `st`, `raw`, and `berry`.

By default, the model also has no scratchpad where it can count characters step by step. There is no explicit `b-e-r-r-y` in this representation, and there is no built-in character counter or calculator attached to the token.

There is no field attached to the `berry` token that says, "this chunk contains two r's." The model can learn facts about spelling from millions of training examples, but that information is implicit in its parameters rather than directly exposed as a list of characters.

That makes letter counting an awkward task. A language model is trained to predict the next token, not to execute a character-counting algorithm.

Modern models tend to do better on examples like this for two reasons. First, training can explicitly include spelling and character-level tasks. Second, a model can turn the problem into an easier intermediate representation - for example, by spelling `strawberry` as `s-t-r-a-w-b-e-r-r-y` before counting.

Adding separators changes how the intermediate text is tokenized. Individual letters become easier to isolate, and the model can feed that new representation back into its next prediction. More inference-time reasoning gives it room to perform this workaround.

This does not mean the tokenizer has gone away. It means the model has learned a strategy for working around a representation that is poorly suited to the task.

## From token IDs to vectors

Token IDs are still not the numbers that flow through the model's transformer layers.

Inside the model weights is an **embedding table**. You can picture it as a large matrix with one row for every token in the vocabulary. A token ID selects its corresponding row.

For `strawberry`, the tokenizer first produces:

```text
[302, 1618, 19772]
```

The model then looks up rows 302, 1618, and 19772 in the embedding table. Each row is a vector: a long list of numbers that provides the token's initial internal representation.

```text
token ID 302   → embedding vector for "st"
token ID 1618  → embedding vector for "raw"
token ID 19772 → embedding vector for "berry"
```

These vectors are where the transformer layers really begin. As they pass through the transformer layers, they are repeatedly updated with information from the surrounding context. By the time the model predicts a response, the representation of a token contains much more than the original lookup - but text itself never entered the weights.

Your words became chunks. The chunks became IDs. The IDs became vectors.

And only then did the model see them.

In the next part, we will follow those vectors through the model and see how they turn into a prediction for the next token.
