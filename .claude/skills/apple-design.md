---
name: apple-design
description: Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or reviewing gesture-driven UI, spring animations, drag/swipe/sheet interactions, momentum and interruptible transitions, translucent materials and depth, typography (optical sizing, tracking, leading), reduced-motion, or the design foundations (feedback, spatial consistency, restraint) behind Apple-style interfaces.
---

# Apple Design

## Initial Response

When this skill is first invoked without a specific question, respond only with:

> I'm ready to help you build fluid, Apple-style interfaces on the web, my knowledge comes from Apple's WWDC design talks, translated for the web.

Do not provide any other information until the user asks a question.

How Apple builds interfaces that stop feeling like a computer and start feeling like an extension of you. This knowledge comes from Apple's WWDC design talks — chiefly *Designing Fluid Interfaces* (WWDC 2018) — distilled and translated into the web platform (CSS, Pointer Events, `requestAnimationFrame`, spring libraries like Motion/Framer Motion).

The through-line: **an interface feels alive when motion starts from the current on-screen value, inherits the user's velocity, projects momentum forward, and can be grabbed and reversed at any instant.** Springs are the tool that makes all of this natural, because they are inherently interruptible and velocity-aware.

## The Core Idea

> "When we align the interface to the way we think and move, something magical happens — it stops feeling like a computer and starts feeling like a seamless extension of us."

An interface is fluid when it behaves like the physical world: things respond instantly, move continuously, carry momentum, resist at boundaries, and can be redirected mid-motion. Everything below is a way to get closer to that.

Apple frames design as serving four human needs: **safety/predictability, understanding, achievement, and joy.** Every rule here serves one of them.

## 1. Response — kill latency

The moment lag appears, the feeling of directness "falls off a cliff." Response is the foundation everything else is built on.

- **Respond on pointer-down, not on release.** Highlight a button the instant it's pressed. Waiting for `click`/touch-up to show feedback feels dead.
- **Be vigilant about every latency.** Audit debounces, artificial timers, transition waits, and the ~300ms tap delay. Anything on the input path that isn't essential is a regression.
- **Feedback must be continuous *during* the interaction, not just at the end.** For a drag, slider, or drawer, update the UI 1:1 with the pointer the whole way through — never animate only when the gesture completes.

## 2. Direct manipulation — 1:1 tracking

> "Touch and content should move together."

When the user drags something, it must stay glued to the finger — and respect the offset from *where they grabbed it*. Snapping to the element's center on grab breaks the illusion immediately.

## 3. Interruptibility — the single most important principle

> "The thought and the gesture happen in parallel."

Every animation must be interruptible and redirectable at any moment. A user must be able to grab a moving element mid-flight and reverse it without waiting for the animation to finish.

- **Never lock out input during a transition.**
- **Always animate from the *presentation* (current) value, never the target value.**
- **Avoid CSS transitions and `@keyframes` for anything gesture-driven.**
- **When a gesture reverses, blend velocity — don't hard-cut it.**

## 4. Behavior over animation — use springs

> "Think of animation as a conversation between you and the object."

A pre-scripted, fixed-duration animation can't respond to new input. A spring can.

**Defaults:**
- Start most UI at **damping `1.0`** (critically damped) — graceful and non-distracting.
- Add bounce (**damping ~`0.8`**) **only when the gesture itself carried momentum**.

**Concrete values Apple ships:**

| Interaction | Damping | Response |
| --- | --- | --- |
| Move / reposition | `1.0` | `0.4` |
| Rotation | `0.8` | `0.4` |
| Drawer / sheet | `0.8` | `0.3` |

## 5. Velocity handoff — the seam between drag and animation

When a gesture ends, the animation must **continue at the finger's exact velocity**, so there's no visible seam between dragging and animating.

## 6. Momentum projection — animate to where the gesture is *going*

Don't snap to the nearest boundary from the *release point*. Use velocity to **project the resting position** — exactly like scroll deceleration.

Apple's exact projection function:

```js
function project(initialVelocity, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}
```

## 7. Spatial consistency — symmetric paths, anchored origins

- **Enter and exit along the same path.**
- **Anchor interactions to their source.**
- **Mirror the easing on reversible transitions.**

## 8. Hint in the direction of the gesture

Intermediate motion should telegraph where things are going.

## 9. Rubber-banding — soft boundaries

At an edge, resist progressively instead of stopping hard.

```js
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## 10. Gesture design details

- **Tap:** highlight on touch-down (instant), commit on touch-up.
- **Drag/swipe:** require ~10px threshold before committing to a direction.
- **Detect all plausible gestures in parallel from the first move.**

## 11. Frame-level smoothness

- Keep per-frame positional change below the perception threshold.
- Animate only compositor-friendly properties — `transform` and `opacity`.

## 12. Materials & depth — translucency conveys hierarchy

Apple uses translucent materials as a floating functional layer.

```css
.toolbar {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.4);
}
```

- **Material weight encodes hierarchy.**
- **Scroll edge effects, not hard dividers.**
- **Materialize, don't just fade.**

## 13. Multimodal feedback — motion + sound + haptics

Three rules:
1. **Causality** — trigger on the actual causal event.
2. **Harmony** — visual, sound, and haptic must fire on the **same frame**.
3. **Utility** — add feedback only where it earns its place.

## 14. Reduced motion & accessibility

Reduced motion means a gentler, non-vestibular equivalent:
- Replace slides/springs/parallax with short opacity **cross-fades**.
- Make translucent surfaces frostier/solid.
- Avoid full-viewport moving backgrounds.

## 15. Typography — optical sizing, tracking, leading

- **Tracking (letter-spacing) is size-specific — never one value for all sizes.**
- **Leading (line-height) tracks size inversely.**
- **Default to the platform's system font** before a custom face.

## 16. Design foundations — the eight principles

1. **Purpose** — Make with intention; decide what *not* to build.
2. **Agency** — Keep people in control; easy undo.
3. **Responsibility** — Act in the user's interest.
4. **Familiarity** — Build on what people already know.
5. **Flexibility** — Design for different contexts, devices, and abilities.
6. **Simplicity** — Strip the unnecessary so the core purpose shines.
7. **Craft** — Uncompromising attention to detail builds trust.
8. **Delight** — The result of getting the other seven right, not confetti tacked on top.

## 17. Process

- **Prototype interactively** — an interactive demo is worth "a million static designs."
- **Design interaction and visuals together.**
- **Test with real people in real context.**

## Quick Reference

| Need | Technique | Concrete value |
| --- | --- | --- |
| Default UI spring | Critically damped, no overshoot | `damping 1.0`, `response 0.3–0.4` |
| Momentum / flick spring | Under-damped, slight bounce | `damping ~0.8`, `response 0.3–0.4` |
| Flick landing point | Project momentum | `current + (v/1000)·d/(1−d)`, `d ≈ 0.998` |
| Interrupt cleanly | Start from presentation (live) value | read the on-screen transform |
| 1:1 drag | Pointer Events + capture | respect the grab offset |
| Feedback | On pointer-down, continuous | never only at the end |
| Boundary | Rubber-band, don't hard-stop | progressive resistance |
| Translucent chrome | `backdrop-filter` layer | content scrolls under |
| Type tracking | Size-specific, never fixed | tighten large text (`-0.02em`), body near `0` |
| Reduced motion | Cross-fade, not slide/spring | `@media (prefers-reduced-motion)` |
