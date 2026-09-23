import torch
from torch.nn import functional as F

from data import decode, encode, get_batch, vocab_size
from model import GPT, GPTConfig


torch.manual_seed(1337)
device = "cuda" if torch.cuda.is_available() else "cpu"
config = GPTConfig(n_layer=1, n_head=1, n_embd=32, block_size=8,
                   vocab_size=vocab_size)
model = GPT(config).to(device)
model.eval()

with torch.no_grad():
    x, y = get_batch("train", block_size=config.block_size, device=device)
    _, loss = model(x, y)
    print(f"Untrained batch loss: {loss.item():.3f}")

    prompt = "Hello, "
    idx = torch.tensor([encode(prompt)], dtype=torch.long, device=device)
    logits, _ = model(idx)
    next_logits = logits[:, -1, :]
    probs = F.softmax(next_logits, dim=-1)
    next_token = torch.multinomial(probs, num_samples=1)
    print("Probability shape:", tuple(probs.shape))
    print("One sampled character:", repr(decode(next_token[0].tolist())))
