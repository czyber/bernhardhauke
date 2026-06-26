---
title: "tinyloop: What makes clankers clank"
description: "A deliberately small coding agent, you can understand in an afternoon"
pubDate: 2026-06-25
tags:
  - Agent tooling
  - Project
  - AI
---

[View the tinyloop project page](/projects/tinyloop/)

In this article:
- what turns an LLM into an agent
- what tools actually are
- why events matter in agent UX
- how tinyloop keeps the architecture small

<figure class="prose-figure prose-figure--small">
  <img
    src="/articles/tinyloop/leannk-OUSRuN8JnzM-unsplash.jpg"
    alt="A warmly lit vintage radio and shelves in a dark room"
  />
  <figcaption>
    Photo by
    <a href="https://unsplash.com/@leannk_official?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">leannk.</a>
  </figcaption>
</figure>

The realms of software engineering experienced a drastic change in the previous year or so. When I think back what it used to look like to develop something a year ago (damn, lets not go back 2 years), and what it looks like now - I guess its the same if you compare modern hardware to when you had dial-up internet in the 2000s.

The process changed so quickly and so drastically, first GitHub Copilot was this weird and somewhat (not) working tool that made autocomplete do some inline completions. ChatGPT emerged and we could play around and poke it, copy-paste some snippets from the IDE and hope it would not hallucinate stuff or derail too quickly. When Anthropic released Claude Code, the game changed.

LLM technology became something no developer could ignore any longer. Some like it, some hate it, but one thing is for sure: In some form or another, _it is here to stay_.

Next to Claude Code, Codex and Pi, a gazillion other coding agents wait to hammer away at your codebase. Generating piles of code. They interact with their environment and are not any more merely a question-answer machinery.

[64% of developers already use agentic tools, and another 21% are exploring or planning to do so.](https://www.sonarsource.com/state-of-code-developer-survey-report.pdf)

If you used an agent before and just wonder: What is necessary that a simple question-answer tool becomes a capable agent that can do changes in my codebase and use other tools - **tinyloop** is a good starting point - hence I will take it as an example for this article. It's a small coding agent, heavily inspired by Pi.

## The Core

Right in the core of every agent, sits a Large Language Model. _You ask it a question - it answers_.

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.responses.create({
  model: "gpt-4.1-mini",
  input: "Explain recursion like I'm 10.",
});

console.log(response.output_text);
```

This is the basic chitty chatty you already know from early ChatGPT days and Copilot. You feed the model some input and it answers. No magic code edits, no browser use. In 2023, Meta came out with a paper about [Toolformer](https://openreview.net/forum?id=Yacmpz84TH), a model capable of tool use. Simply said, those are LLMs which can produce reliable JSON and decide when to call a tool or not. Later, this became the de facto standard - OpenAI called it [Function Calling](https://developers.openai.com/api/docs/guides/function-calling), while Anthropic called it [Tool Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview).

## Tools

But what are tools?
Dead simple, you tell the LLM that you provide extra functionality, that it can use if necessary. And you also provide information about how and when to use it.

Let's do a simple example.

### Scenario: No Tool Use

Suppose you have an LLM that never saw any data about Pokémon during training (poor thing). And now you ask it "_What is the weight of Pikachu?_". It does not have a chance of telling you and will either make something up (hallucinate) or tell you that it does not know.

### Scenario: Tool Use

With tool use, you yourself provide the functionality the LLM needs to complete the task. In this scenario, it needs a way of retrieving data about Pokémon. So you could write a function that based on the name of the Pokémon, retrieves data from an API and returns a selection (e.g. the weight).

```js
async function getPokemonWeight({ name }) {
  const res = await fetch(
    `https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`,
  );

  if (!res.ok) {
    throw new Error(`Pokemon not found: ${name}`);
  }

  const pokemon = await res.json();

  return {
    name: pokemon.name,
    weight: pokemon.weight,
    unit: "hectograms",
    weightKg: pokemon.weight / 10,
  };
}
```

Now that you have the functionality in place, you need to tell the LLM about it, so it knows it exists and it can call it. This is where the _tool definition_ comes in. Essentially, the LLM provider tells you what the LLM expects to know about how to call a tool. For OpenAI it follows this format:

```js
const pokemonTool = {
  type: "function",
  name: "getPokemonWeightTool", // A name you provide the LLM to reference this tool
  description: "Get the weight of a Pokémon by name.", // Important so the model knows when it should use this tool
  parameters: {
    type: "object",
    // The input of the function
    properties: {
      name: {
        type: "string",
        description: "The Pokémon name, e.g. pikachu",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
};
```

After defining your tools, you just pass them to the LLM call:

```js
const response = await client.responses.create({
  model: "gpt-4.1-mini",
  input: "What's the weight of Pikachu?",
  tools: [pokemonTool],
});
```

Now the LLM will receive your prompt and the tool definitions, it will initiate a _tool call_. The LLM itself has no direct access to your runtime, hence it can't directly execute the function. It will answer with a specific response - stating which tool it wants to call and with which parameters:

```js
[
  {
    type: "function_call",
    id: "fc_...", // Response ID
    call_id: "call_...",
    name: "getPokemonWeightTool", // The LLM tells you which Tool to call
    arguments: '{"name":"pikachu"}', // Input parameters, defined in your tool definition
  },
];
```

Normally this is where you would check the LLM responses if they are of type `function_call`, if so, you would match the tool `name` (e.g. `getPokemonWeightTool`) and call the corresponding function `getPokemonWeight`.

Now comes an important part. After calling the `getPokemonWeight` function, implicitly calling the PokeAPI, and retrieving the data - **you** have the result - but not the LLM. It's last state is still "_I want to call the_ `getPokemonWeightTool` _tool_". So, now you have to call the LLM once again and spread the news about the retrieved Pokémon data. It will then respond with the result woven into its response, e.g.: `Pikachu weighs 6kg.`.

### Translate To Coding Agent, pls

The same holds for the tools a coding agent needs to handle software engineering tasks:

- read files
- write files
- edit files
- run commands

You provide the tools, it calls them, your code reports back (e.g. file snippets, diffs, terminal output). These four tools are trivial to implement and can be seen in [tinyloop's tools](https://github.com/czyber/tinyloop/tree/main/packages/agent/src/tools).

## As Simple As That
This already concludes what an agent does under the hood. Sure there is more to it, but this is what matters. The agent does it's work now, but we need to interact with it, we want live updates and we want to scream at it. Let's start with the updates of the agent, since we just went through its implementation.

## Thinking About Us
Now the agent does its job, but what about us? How would we as a user like to interact with the agent? We want to do two things really: _look at the output it produces and give it input, this could be a prompt - but also something else, e.g. approving a tool call_.

### The Agent's Output 
To get the agents output, we want it to signal us if specific events we care about occur, e.g. a tool is called or finished. We also want events for normal question-answer responses. When we have a conversation with the agent, we call that a _session_. 

We want to **dispatch** a command (e.g. a prompt, approval) and we want to consume the **events** it emits.

The way this is done in **tinyloop** is by providing two methods as an interface of the agent: `dispatch()` and `events()`.

`dispatch()` is straight-forward, we are just forwarding the user input to the model. `events()` on the other hand is something that should be consumed in realtime, as the agent emits events. In many languages there is the concept of async generators, which are functions that allow you to iterate/consume elements as they come in. Handy, right?

This async generator is populated by the agent in multiple places, for example when tools are called or completed.

```ts
export async function runToolCalls(
  tools: ToolMap,
  toolCalls: ResponseFunctionToolCall[],
  options: { emit: AgentEventSink },
): Promise<ToolOutput[]> {
  const toolOutputs: ToolOutput[] = [];

  for (const toolCall of toolCalls) {
    // The important part
    // Before a tool is called, we emit the "tool.execution.started" event
    // It carries information about the tool and which inputs will be used
    options?.emit({
      type: "tool.execution.started",
      name: toolCall.name,
      callId: toolCall.call_id,
      args: toolCall.arguments,
    }); 
    const execution = await handleToolCall(tools, toolCall, options);
    toolOutputs.push(execution.output);

    // After the tool call has finished, we emit another event "tool.execution.finished"
    // It carries information about the tool call result, s.a. the raw output and a structured representation
    options?.emit(
      toToolFinishedEvent(toolCall.name, toolCall.call_id, execution.result.output, execution.result.details),
    );
  }

  return toolOutputs;
}
```

At this point it might make sense to illustrate what consuming this async generator looks like in the most simple way.

If you have a script that consumes the `events()` like this:
```ts
for await (const event of agent.events()) {
  console.log(event);
}
```

```json
{
  type: "tool.execution.started",
  name: "readFile",
  args: "{\"path\":\"package.json\"}"
}

{
  type: "tool.execution.finished",
  name: "readFile",
  output: "{ <contents of package.json> }"
}

{
  type: "assistant.message",
  text: "I read the package.json file."
}
```

As events come in, they would be printed.

### Blingify It!
As we most likely are not used to raw prints, we will render some TUI components based on the events.

This is where the architecture becomes useful. We do not want the terminal interface to know how OpenAI works, how tools are executed, or how many model calls happen inside one turn. The UI should only know about a session. It sends user input in one direction and receives events from the other direction.

In **tinyloop**, this boundary is the `SessionDriver`.

```ts
export type SessionDriver = {
  sendUserMessage(text: string): Promise<void>;
  events(): AsyncIterable<UiSessionEvent>;
};
```

That is tiny, but it is doing a lot of architectural work. The UI can talk to a real agent session, a fake session, or a demo session without changing the rendering code. You can see this split in the [`packages/tui/src/session`](https://github.com/czyber/tinyloop/tree/main/packages/tui/src/session) folder.

The real driver is just an adapter:

```ts
export function createAgentSessionDriver(workspaceRoot: string): SessionDriver {
  const session = new AgentSession(new Agent({ workspaceRoot }));

  return {
    sendUserMessage: (text) => session.dispatch({ type: "user_message", text }),
    async *events() {
      for await (const event of session.events()) {
        yield toUiSessionEvent(event);
      }
    },
  };
}
```

So we have three layers now:

1. `Agent` knows how to call the model and tools.
2. `AgentSession` knows how to turn commands into ordered events.
3. `SessionDriver` gives the UI a small interface it can consume.

The UI does not care that `run_command` uses `spawn`, or that `edit_file` uses a snippet replacement, or that the agent might need multiple tool turns before it can answer. The UI receives a stream of normalized events.

## From Events To Interface

The next piece is a reducer. If you have used React state management before, this will feel familiar. Each event comes in, and the reducer folds it into a view model.

In **tinyloop**, events become turns. Turns contain transcript items. Transcript items can be user messages, assistant messages, tool calls, or errors.

Roughly speaking:

```text
event -> reducer -> TUI state -> Ink components
```

A `tool.started` event appends a running tool card. A `tool.progress` event appends output to that card. A `tool.finished` event marks it as completed and stores structured details.

This is important because tools are not instant, invisible function calls. They are part of the user experience. When an agent runs `pnpm test`, edits a file, or reads a config, the user should see that motion. Not every byte needs to be shown, but the user should understand what the agent is doing and where the result came from.

That is what the [`reduceSessionEvent`](https://github.com/czyber/tinyloop/blob/main/packages/tui/src/state/reduce-session-event.ts) function does. It makes the agent legible.

## Tool Cards

The final step is rendering. The TUI has a `ToolCard` component that takes a tool transcript item and turns it into a small terminal panel.

It shows:

- the tool name
- whether it is running or completed
- the important argument, like a command or file path
- a trimmed output preview
- diffs as diff-flavored code blocks
- exit codes for commands

This sounds cosmetic, but it is actually part of the agent contract. If a coding agent changes a file and you only see the final assistant message, you have to trust it too much. If you see the tool card, the diff, and the exit code, you can stay oriented, and if necessary intervene. This might be opinionated, but I still very much favor to _know_ what the agent actually does and _what code it produces_. Often you can determine from the first few edits, if the agent will do what you want it to do for the next 10 minutes.

That is the small shift from chatbot to coding agent: the model is not just speaking. It is acting in a workspace, and the interface shows enough of those actions that a human can follow along.

## The Full Loop

So if we put the whole thing together, a tiny coding agent looks like this:

1. The user sends a message.
2. The session starts a turn and emits a `user.message` event.
3. The agent sends the prompt, tools, and previous response id to the model.
4. The model either answers or requests one or more tools.
5. The agent executes the tools inside the workspace.
6. Tool output is sent back to the model as `function_call_output`.
7. The model continues until it can answer.
8. The session emits the assistant message and completes the turn.
9. The UI consumes the events and renders the transcript.

This is basically the clanker machinery. Not magic. Just a loop, a set of tools, and an event stream that keeps the user in the room.

## What tinyloop Leaves Out

The nice thing about a small project is that the missing pieces are visible too.

A production coding agent needs more: approvals, cancellation, interrupts, resumable sessions, steering, queued messages, better sandboxing, richer diffs, maybe a browser UI, maybe persistence. 

**tinyloop** is valuable precisely because it stops before all of that becomes a platform. You can read it and see the bones:

- a model loop in [`packages/agent/src/agent.ts`](https://github.com/czyber/tinyloop/blob/main/packages/agent/src/agent.ts)
- a session event stream in [`packages/agent/src/session.ts`](https://github.com/czyber/tinyloop/blob/main/packages/agent/src/session.ts)
- four basic tools in [`packages/agent/src/tools`](https://github.com/czyber/tinyloop/tree/main/packages/agent/src/tools)
- a terminal UI boundary in [`packages/tui/src/session`](https://github.com/czyber/tinyloop/tree/main/packages/tui/src/session)
- a reducer that turns events into interface state in [`packages/tui/src/state`](https://github.com/czyber/tinyloop/tree/main/packages/tui/src/state)

That is enough to understand the core idea. Once you see those pieces, bigger agents become less mysterious. They have more layers, better safety systems, more careful prompting, better interfaces, and a lot more operational hardening. But the clank is still recognizable.

The model asks for a tool. Your code runs it. The result goes back. The interface tells the human what happened. Clank clank.

_That is the loop._
