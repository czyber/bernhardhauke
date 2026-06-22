---
title: "A small calibration pass"
description: "A short note about making an interface feel measured, tactile, and quiet."
pubDate: 2026-06-21
tags:
  - Design system
  - Interface
  - Notes
---

The smallest details on a personal site should feel less like decoration and more like alignment. A rail, a tick, a focus ring, or a hover state can make the page feel assembled instead of merely styled.

The trick is to make every motion answer the same question: what changed, and where should the eye go next? This site uses [Astro content collections](https://docs.astro.build/en/guides/content-collections/) for the writing layer, and the [personal website project](/projects/personal-website/) keeps the system visible as it evolves.

## Mechanical, not loud

A tactile interface does not need to imitate hardware. It only needs to borrow a few useful habits from it:

- stable surfaces that do not jump under the pointer
- visible states that feel measured, not theatrical
- small marks that explain position, order, or pressure

The calibration loop stays deliberately small:

1. define the job of the detail
2. set the motion budget
3. remove anything that only performs

> The page should not perform. It should register, respond, and settle.

Inline details matter too. A token like `--ruler-marker` should read as part of the system, and a shortcut like <kbd>Tab</kbd> should feel like it belongs in the same material language.

## Motion budget

| Detail           | Purpose           | Budget       |
| ---------------- | ----------------- | ------------ |
| Grid reveal      | spatial texture   | pointer only |
| Card glow        | surface feedback  | hover only   |
| Ruler marker     | page position     | scroll only  |
| Rail calibration | page registration | load once    |

The code can stay just as restrained as the visual layer:

```ts
type MotionRole = "position" | "surface" | "registration";

const motionBudget: Record<MotionRole, number> = {
  position: 220,
  surface: 180,
  registration: 500,
};

export function durationFor(role: MotionRole) {
  return `${motionBudget[role]}ms`;
}
```

## What stays still

The premium feeling comes from the parts that do not move. Body copy should keep an even measure, cards should hold their geometry, and decoration should disappear the moment it stops carrying information.

---

The result is quiet, but not plain: a page that feels like it has been machined, checked, and left ready to use.
