---
name: animate-expo
description: Build animations in React Native and Expo, making the decisions in the order that determines whether they feel right — should it animate, which thread it runs on, which properties, spring or timing, how the gesture hands off, how it degrades. Writes the implementation with Reanimated, Gesture Handler, Expo Router and expo-haptics. Use when animating anything in an Expo app, adding gestures, sheets, screen transitions, press feedback or haptics, or fixing motion that stutters on device. For web animation use `animate`.
---

# Building Animations in Expo

## Initial Response

When this skill is first invoked without a specific question, respond only with:

> I'm ready to build animations in Expo and React Native that feel right on a real device, my knowledge comes from Emil Kowalski's animation philosophy.

Do not provide any other information until the user asks a question.

A construction skill for React Native. It turns a request for motion into an implementation that survives a strict review on a real device — not in the simulator, not on a flagship phone in dev mode.

Mobile changes three things about animation:

1. **There is no hover.** Every affordance the web puts in hover has to live in press, position, or nothing.
2. **There are two runtimes.** The React Native runtime and the UI runtime (Reanimated worklets). An animation that touches the RN runtime stutters the moment the app does anything else.
3. **The user's finger is on the element.** Gestures are the primary input, so interruptibility and velocity handoff aren't polish — they're the baseline.

## Hard Rules

1. **Run the sequence in order.** Steps 1 and 2 gate everything.
2. **Reanimated, not core `Animated`.**
3. **No approximated values.** Curves and spring configs come from the tables below.
4. **Reduced motion ships with the animation**, not as a follow-up.
5. **Feel is judged on a release build on the slowest device you support.**

## The Build Sequence

### 1. Should this animate at all?

| Frequency | Decision |
| --- | --- |
| 100+ times/day — tab switches, keyboard, toggles | **No animation.** Stop here. |
| Tens of times/day — press feedback, list navigation | Near-imperceptible only: under 150ms, or nothing |
| Occasional — sheets, modals, toasts, onboarding | Standard animation |
| Rare / first-time — success states, celebrations | The delight budget lives here |

**Tab switches never slide.** `animation: 'none'`.

### 2. What is the purpose?

Name it in one word: **feedback**, **spatial consistency**, **state indication**, **preventing a jarring change**, **explanation**, or **delight**.

Can't name it? Don't build it.

### 3. Pick the tool — cheapest that works

| Need | Tool |
| --- | --- |
| A state-driven change with no gesture | **Reanimated CSS transition** |
| Loop, multi-stage, or plays on mount | **Reanimated CSS animation** |
| Element mounting/unmounting, list reflow | **Layout animations** (`entering` / `exiting` / `itemLayoutAnimation`) |
| Anything a finger touches, or derived from scroll | **`useSharedValue` + `Gesture` + `useAnimatedStyle`** |
| Screen to screen | **Native stack options in Expo Router. Never hand-roll this** |
| Bottom sheet that is its own screen | **`presentation: 'formSheet'`** — free and correct |
| Tab bar | **`NativeTabs`** from `expo-router/unstable-native-tabs` |
| Context menu, press-and-hold preview | **`Link.Menu` / `Link.Preview`** (Expo Router) |
| Header that collapses | **`headerLargeTitleEnabled`** on the native stack |
| Pull to refresh | **`RefreshControl`** |
| UI that tracks the keyboard | **`react-native-keyboard-controller`** |
| Vector illustration, celebration | **Lottie** — for illustration only |

**Dependencies.** Install with `npx expo install <package>`:

| Need | Package |
| --- | --- |
| Animation | `react-native-reanimated` + `react-native-worklets` |
| Gestures | `react-native-gesture-handler` |
| Navigation, sheets, native tabs | `expo-router` |
| Haptics | `expo-haptics` |
| Keyboard-following UI | `react-native-keyboard-controller` |
| Illustration, celebration | `lottie-react-native` |

### 4. Pick the properties

- **`transform` and `opacity` are free.** Everything else is a layout pass.
- **The one exception:** an absolutely positioned element with no children.
- **Never `scale(0)`.** Start from `scale(0.9–0.97)` + `opacity: 0`.
- **`transform` is an array and order matters** — keep translate first.
- **Android shadows are `elevation`** — animate opacity of a pre-shadowed layer instead.
- **Never animate `BlurView` intensity.** Crossfade the opacity of a static `BlurView` instead.

### 5. Timing or spring

**If a finger was involved, use a spring.** Everything else uses timing.

| Interaction | Config |
| --- | --- |
| Default settle, no overshoot | `{ duration: 400, dampingRatio: 1 }` |
| Reposition / snap back after a drag | `{ duration: 400, dampingRatio: 0.8, velocity }` |
| Sheet, drawer | `{ duration: 300, dampingRatio: 0.8, velocity }` |
| Must not pass a hard edge | add `overshootClamping: true` |

**Easing**, for everything without a finger:

```js
import { Easing } from 'react-native-reanimated';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);      // strong ease-out for UI
const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);  // on-screen movement
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);    // iOS sheet curve
```

**Duration:**

| Element | Duration |
| --- | --- |
| Press feedback | 100–150ms |
| Toggle, chip, small state change | 150–200ms |
| Sheet, modal, drawer | spring, ~300ms perceived |
| Screen transition | the platform default — don't override it |

### 6. Keep it off the JS thread

- **Never `setState` from a gesture or scroll handler.**
- **Never `scheduleOnRN` per frame** — use `onEnd`, or `useAnimatedReaction` at a threshold.
- **Never read/write a shared value during render** — use `.get()` / `.set()` in worklets, handlers, effects.
- **Functions called from a worklet need `'worklet'`** as their first line.

### 7. Press, not hover

- **Feedback on press-in, commit on press-out.**
- **`scale: 0.97` in 100–150ms** on any pressable.
- **44×44pt minimum touch target** (48dp Android). Add `hitSlop` if visual is smaller.
- **`pressRetentionOffset`** so a drifting finger doesn't cancel an intended press.

### 8. Haptics

| Moment | Call |
| --- | --- |
| Value ticks past a step — picker, slider detent | `Haptics.selectionAsync()` |
| Something snaps home, a sheet detent catches | `Haptics.impactAsync(ImpactFeedbackStyle.Light)` |
| A heavy object lands, destructive action | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` |
| Operation succeeded or failed | `Haptics.notificationAsync(NotificationFeedbackType.Success / Error)` |

Three absolute rules:
- **Same frame as the visual.**
- **One per user action.** Never on scroll, never per frame.
- **Never the only feedback.**

From a worklet: `scheduleOnRN(Haptics.selectionAsync)`.

### 9. Reduced motion and accessibility

```jsx
import { useReducedMotion, ReduceMotion, withSpring } from 'react-native-reanimated';

const reduced = useReducedMotion();
const y = useSharedValue(reduced ? 0 : SHEET_HEIGHT);

withSpring(0, { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System });
```

Reduced motion: keep opacity and color changes, drop translation, scale, parallax and overshoot. Screen transitions become `animation: 'fade'`.

## Setup Checklist

- Install: `npx expo install react-native-reanimated react-native-worklets`
- `GestureHandlerRootView` wraps the app root
- Reanimated 4 requires the New Architecture
- **Judge feel in a release build** — never Expo Go

## 120fps

Set in `app.json` for ProMotion iPhones:
```json
{ "expo": { "ios": { "infoPlist": { "CADisableMinimumFrameDurationOnPhone": true } } } }
```

## Never Ship

| Never | Instead |
| --- | --- |
| `PanResponder` | `Gesture.Pan()` from gesture-handler |
| `setState` in a gesture or scroll handler | shared value + `useAnimatedStyle` |
| `runOnJS` (deprecated in Reanimated 4) | `scheduleOnRN` from `react-native-worklets` |
| `scheduleOnRN` per frame | `onEnd`, or `useAnimatedReaction` at a threshold |
| Reading or writing a shared value during render | `.get()` / `.set()` in worklets, handlers, effects |
| Core `Animated` for anything a finger touches | Reanimated |
| Animating `height` / `width` / `margin` / `flex` | `transform` + `opacity` |
| Animating `BlurView` intensity | crossfade a static layer |
| `entering` on a virtualized list row | animate the container, or `itemLayoutAnimation` |
| A screen transition rebuilt in JS | native stack `animation` |
| Sliding between tabs | `animation: 'none'` |
| `scale(0)` entrance | `scale(0.95)` + `opacity: 0` |
| Distance-only dismissal threshold | velocity **or** distance — a flick is enough |
| Hard stop at a boundary | rubber-band resistance |
| A haptic per frame, or as the only feedback | one per commit, always paired with a visual |
| Judging feel in Expo Go or the simulator | release build, slowest supported device |

## Key Recipes

### Press feedback
```jsx
const [pressed, setPressed] = useState(false);
<Pressable onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} hitSlop={12}>
  <Animated.View style={[styles.box, pressed && styles.pressed]}>{children}</Animated.View>
</Pressable>

const styles = StyleSheet.create({
  box: {
    transitionProperty: 'transform',
    transitionDuration: '120ms',
    transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
  },
  pressed: { transform: [{ scale: 0.97 }] },
});
```

### Drag-to-dismiss sheet
```jsx
const translateY = useSharedValue(0);
const context = useSharedValue(0);

const pan = useMemo(() => Gesture.Pan()
  .activeOffsetY([-10, 10])
  .onStart(() => { context.set(translateY.get()); })
  .onUpdate((e) => {
    const next = context.get() + e.translationY;
    translateY.set(next >= 0 ? next : rubberband(next, HEIGHT));
  })
  .onEnd((e) => {
    const projected = translateY.get() + project(e.velocityY);
    if (projected > HEIGHT * 0.4) {
      translateY.set(withSpring(HEIGHT, {
        duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true,
      }, (finished) => { if (finished) scheduleOnRN(onClose); }));
    } else {
      translateY.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }));
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
    }
  }), [onClose]);
```

### Collapsing header
```jsx
const scrollY = useSharedValue(0);
const onScroll = useAnimatedScrollHandler((e) => { scrollY.set(e.contentOffset.y); });

const titleStyle = useAnimatedStyle(() => ({
  opacity: interpolate(scrollY.get(), [0, 60], [1, 0], Extrapolation.CLAMP),
  transform: [{ translateY: interpolate(scrollY.get(), [0, 60], [0, -12], Extrapolation.CLAMP) }],
}));
```
**Never animate the header's `height` to collapse it** — use transform + clip.

### Shared worklets
```js
function project(velocity, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot, dimension, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## Output

Write the code. Then, in at most a few lines:
- **The gate result** — frequency tier and named purpose.
- **The ingredients** — tool, properties, spring or curve + duration, thread.
- **What to feel-check on device** — gestures, velocity handoff and haptic timing.
