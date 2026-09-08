"""Run the article's GPT-2 experiments: python3 work/blog-part-3/evidence.py.

Uses CPU float32, torch 2.8.0 and transformers 4.57.6 for the recorded run.
Downloads the public checkpoint if it is not already cached.
"""
import json
import platform
from pathlib import Path

import torch
import transformers
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL = "gpt2"
REVISION = "607a30d783dfa663caf39e06633721c8d4cfcd7e"
PROMPT = "the river bank was"
OUT = Path(__file__).resolve().parent


def top_p_filter(logits, p):
    sorted_logits, indices = torch.sort(logits, descending=True)
    cumulative = torch.softmax(sorted_logits, dim=-1).cumsum(dim=-1)
    remove = cumulative >= p
    remove[1:] = remove[:-1].clone()  # keep the token crossing the threshold
    remove[0] = False
    filtered = logits.clone()
    filtered[indices[remove]] = -float("inf")
    return filtered


def main():
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
    lm = AutoModelForCausalLM.from_pretrained(
        MODEL, revision=REVISION, attn_implementation="eager"
    ).cpu().eval()
    initial_ids = tokenizer(PROMPT, return_tensors="pt")["input_ids"]

    @torch.no_grad()
    def run(T=1.0, seed=42, greedy=False, top_p=None, stop_eos=False):
        ids = initial_ids.clone()
        rng = torch.Generator(device="cpu").manual_seed(seed)
        steps = []
        stopped = False
        for _ in range(50):
            logits = lm(ids, use_cache=False).logits[0, -1] / T
            if top_p is not None:
                logits = top_p_filter(logits, top_p)
            probs = torch.softmax(logits, dim=-1)
            next_id = logits.argmax().reshape(1) if greedy else torch.multinomial(
                probs, num_samples=1, generator=rng
            )
            ids = torch.cat([ids, next_id.reshape(1, 1)], dim=1)
            steps.append({"id": next_id.item(), "text": tokenizer.decode(ids[0])})
            if stop_eos and next_id.item() == tokenizer.eos_token_id:
                stopped = True
                break
        return {"temperature": T, "seed": seed, "greedy": greedy,
                "top_p": top_p, "stop_eos": stop_eos, "stopped_on_eos": stopped,
                "new_tokens": len(steps), "text": tokenizer.decode(ids[0]),
                "token_ids": ids[0].tolist(), "steps": steps}

    with torch.no_grad():
        logits = lm(initial_ids, use_cache=False).logits[0, -1]
    top_ids = logits.topk(5).indices
    distributions = []
    for T in [0.5, 1.0, 2.0]:
        probs = torch.softmax(logits / T, dim=0)
        assert (logits / T).argmax() == logits.argmax()
        distributions.append({"temperature": T,
            "tokens": [{"id": i.item(), "token": tokenizer.decode([i.item()]),
                        "probability": probs[i].item()} for i in top_ids],
            "other_probability": 1 - probs[top_ids].sum().item(),
            "nucleus_size_p09": int(torch.isfinite(top_p_filter(logits / T, 0.9)).sum())})

    # Verify the nucleus boundary and that masking survives renormalization.
    toy = torch.tensor([0.50, 0.25, 0.15, 0.07, 0.03]).log()
    filtered = top_p_filter(toy, 0.8)
    assert torch.isfinite(filtered).tolist() == [True, True, True, False, False]
    assert torch.softmax(filtered, 0)[3:].sum().item() == 0
    assert torch.isfinite(top_p_filter(torch.tensor([0.5, 0.25, 0.25]).log(), 0.5)).sum().item() == 1
    assert torch.isfinite(top_p_filter(toy, 0.01)).sum().item() == 1
    assert torch.isfinite(top_p_filter(toy, 1.0)).all()

    runs = {}
    configs = {"greedy": {"greedy": True},
        "cold": {"T": 0.001}, "normal": {"T": 1.0}, "hot": {"T": 2.0},
        "nucleus_41": {"seed": 41, "top_p": 0.9, "stop_eos": True},
        "nucleus_42": {"seed": 42, "top_p": 0.9, "stop_eos": True},
        "nucleus_43": {"seed": 43, "top_p": 0.9, "stop_eos": True}}
    for name, config in configs.items():
        runs[name] = run(**config)
        print(name + ": " + runs[name]["text"], flush=True)
    assert runs["cold"]["token_ids"] == runs["greedy"]["token_ids"]
    # Same per-step argmax with and without temperature over the entire greedy path.
    ids = initial_ids.clone()
    with torch.no_grad():
        for next_id in runs["greedy"]["token_ids"][initial_ids.shape[1]:]:
            scores = lm(ids, use_cache=False).logits[0, -1]
            assert torch.softmax(scores / 0.8, 0).argmax().item() == next_id
            ids = torch.cat([ids, torch.tensor([[next_id]])], dim=1)

    # Verify the library payoff against the hand-written greedy loop.
    library_ids = lm.generate(initial_ids, attention_mask=torch.ones_like(initial_ids),
        do_sample=False, max_new_tokens=50,
        use_cache=False, pad_token_id=tokenizer.eos_token_id)
    assert library_ids[0].tolist() == runs["greedy"]["token_ids"]

    result = {"environment": {"python": platform.python_version(),
        "torch": torch.__version__, "transformers": transformers.__version__,
        "device": "cpu", "dtype": "float32", "attention": "eager", "threads": 4,
        "model": MODEL, "revision": REVISION},
        "prompt": PROMPT, "eos_token": tokenizer.eos_token,
        "eos_id": tokenizer.eos_token_id, "distributions": distributions, "runs": runs,
        "checks": ["nucleus cutoff includes crossing token and masks tail",
                   "top-p edge cases retain candidates", "cold sample equals greedy",
                   "temperature plus argmax equals greedy over 50 steps",
                   "hand-written greedy loop equals generate()"]}
    (OUT / "evidence.json").write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print("Saved evidence.json; all checks passed.", flush=True)


if __name__ == "__main__":
    main()
