from pathlib import Path

import torch


text = Path(__file__).with_name("input.txt").read_text(encoding="utf-8")
chars = sorted(set(text))
vocab_size = len(chars)

stoi = {character: index for index, character in enumerate(chars)}
itos = {index: character for character, index in stoi.items()}


def encode(text):
    return [stoi[character] for character in text]


def decode(tokens):
    return "".join(itos[index] for index in tokens)


data = torch.tensor(encode(text), dtype=torch.long)
n = int(0.9 * len(data))
train_data = data[:n]
val_data = data[n:]


def get_batch(split, batch_size=4, block_size=8, device="cpu"):
    if split not in {"train", "val"}:
        raise ValueError("split must be 'train' or 'val'")
    source = train_data if split == "train" else val_data
    if len(source) <= block_size:
        raise ValueError("The split needs at least block_size + 1 characters.")
    ix = torch.randint(len(source) - block_size, (batch_size,))
    x = torch.stack([source[i:i + block_size] for i in ix])
    y = torch.stack([source[i + 1:i + block_size + 1] for i in ix])
    return x.to(device), y.to(device)
