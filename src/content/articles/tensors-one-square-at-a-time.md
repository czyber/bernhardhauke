---
title: "Tensors, one square at a time"
description: "A small visual language for tensors. Every square is a number; every axis gives that number an address."
pubDate: 2026-09-23
tags: [AI, Tensors, Interactive]
---

A shape like `[2, 3, 8, 8]` tells you how many numbers a tensor holds. I also want to see how those numbers are arranged. So let's give each number a little square.

These figures borrow the rounded pixel-grid idea from [Gegell's explanation of Factorio's RNG](https://gegell.github.io/posts/factorio-rng/). Brightness shows magnitude. For signed values, blue means negative and warm orange means positive. You can inspect a square to read its value.

## A number becomes a grid

A scalar needs no index. A vector needs one. A matrix needs two: a row and a column. The shape records the length of each axis; the number of axes is the tensor's **dimensionality**.

<tensor-pixels compact name="scalar" values="0.7" caption="0D · one number">
  <p>A scalar with value 0.7 has shape [].</p>
</tensor-pixels>
<tensor-pixels compact name="vector" values="[0.2,0.5,0.8,1,0.6,0.3]" axes="feature" caption="1D · six numbers">
  <p>A vector with shape [6]: 0.2, 0.5, 0.8, 1, 0.6, 0.3.</p>
</tensor-pixels>
<tensor-pixels compact name="matrix" values="[[0.2,0.5,0.8],[1,0.6,0.3]]" axes="row,column" caption="2D · the same six numbers">
  <p>A matrix with shape [2, 3]: rows [0.2, 0.5, 0.8] and [1, 0.6, 0.3].</p>
</tensor-pixels>

The vector and matrix contain the same six values in the same row-major order. Reshaping from `[6]` to `[2, 3]` changes how you index them: `vector[4]` and `matrix[1, 1]` both hold `0.6`.

## A third axis gives us depth

Stack four **4 × 4** matrices and you can draw the resulting **[4, 4, 4]** tensor as a cube. The first axis selects a layer, the second a row, and the third a column. Different axis lengths give a rectangular block.

Each small cube is one number, with connected front, top, and side faces. Select a layer to cut into the block and reveal the cubes inside. You can also click an exposed cube to open its layer. Switch to **Slices** to see the same tensor as separate matrices.

<tensor-pixels preset="cube" view="3d">
  <p>A [4, 4, 4] tensor containing the numbers 0 through 63 in row-major order. The first layer holds 0–15, the second 16–31, the third 32–47, and the fourth 48–63.</p>
</tensor-pixels>

## A batch is a collection of matrices

Suppose each token has 16 features and each sequence has 8 tokens. One sequence fits into an **8 × 16** matrix. Put two sequences in a batch and the shape becomes **[2, 8, 16]**.

Select a batch below. Each miniature is an entire sequence; the larger grid opens that sequence's token–feature matrix. These are illustrative values, chosen to make the arrangement visible.

The **3D** option puts those same two matrices into a shallow block. Here depth represents the batch axis.

<tensor-pixels preset="embeddings">
  <p>An illustrative tensor x with shape [2, 8, 16]: two batches, eight tokens per batch, and sixteen features per token. Select a batch to inspect its 8 × 16 matrix when JavaScript is available.</p>
</tensor-pixels>

An address such as `x[1, 3, 7]` means: the second sequence, its fourth token, and that token's eighth feature. The axis labels are part of the explanation. Shape alone cannot tell you what an axis means.

## Attention adds another axis

For attention weights, a row describes a **query token** and a column describes a **key token**. The value says how much that query attends to that key. Each head gets its own matrix, and each sequence gets its own set of heads.

Here that gives **[batch, head, query, key] = [2, 3, 8, 8]**. The six miniatures show all combinations of two batches and three heads. Their labels give the batch index followed by the head index. Select one, then inspect a row in the larger grid.

<tensor-pixels preset="attention">
  <p>Attention has shape [2, 3, 8, 8]. Each of two sequences has three attention heads. Each head contains an 8 × 8 matrix of probabilities. Rows sum to 1 and future positions have probability 0. These probabilities are computed from fixed toy queries and keys, not a trained model.</p>
</tensor-pixels>

These probabilities are computed from fixed toy queries and keys. The four-feature dot products are scaled by `√4`, future positions are masked, and softmax is applied across each row. They are not learned attention patterns. The **row sum** under the grid lets you check the normalization, while **Show values** reveals rounded numbers inside the squares.

## A mask makes the rule visible

The same visual language works for Boolean tensors. Here **1 allows attention** and **0 blocks it**. Reading across row 3, four squares are active: positions 0, 1, 2, and 3. Everything to their right is in the future.

<tensor-pixels preset="causal-mask">
  <p>An 8 × 8 causal mask. Entry [query, key] is 1 when key is less than or equal to query, and 0 otherwise. Its lower triangle, including the diagonal, is active.</p>
</tensor-pixels>

The mask itself has only two axes. The same rule can be used for every batch and attention head. Notice how its dark upper triangle appears in every attention matrix above, where blocked entries have zero probability.

You can follow the same idea into the [causal attention implementation in the tiny GPT](/articles/a-tiny-gpt-explained-in-place/#tiny-gpt/note/causal-attention).
