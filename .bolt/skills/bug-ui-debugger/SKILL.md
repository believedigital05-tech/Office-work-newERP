---
name: bug-ui-debugger
description: "Find and fix bugs, broken layouts, and UI glitches in the current project. Use when the user reports something is broken, not working, misaligned, overlapping, crashing, or looks wrong on any screen size."
---

## Full Skill Instructions

### When to trigger this skill
Use this skill whenever the user says things like:
- "this is broken / not working"
- "there's a bug"
- "the UI is glitching / overlapping / cut off"
- "fix this crash / error"
- "it looks wrong on mobile/desktop"
- "buttons/text/layout is misaligned"
- "the Add/Delete/Edit/Submit button doesn't work / does nothing / isn't clickable"
- pastes a console error, stack trace, or screenshot of a broken UI

### Step 1 — Reproduce & Diagnose
1. Read the error message, console log, or screenshot carefully. Identify the exact component/file involved.
2. Check the browser console and network tab (if available) for errors, failed requests, or warnings.
3. Identify whether the issue is:
   - **Logic bug** (wrong data, broken function, state not updating)
   - **UI bug** (layout, spacing, overflow, responsiveness, z-index, alignment)
   - **Build/runtime error** (missing import, syntax error, dependency issue)
4. Trace the issue back to its root cause — don't just patch the symptom.

### Step 2 — Fix Logic Bugs
- Check state management (useState/useEffect dependencies, stale closures, race conditions).
- Verify props are passed and typed correctly.
- Check for off-by-one errors, null/undefined access, and async timing issues.
- Add error boundaries or fallback UI where a crash could occur.

### Step 3 — Fix Non-Functional Buttons (Add / Delete / Edit / Submit, etc.)
This is one of the most common Bolt.new issues: a button is visible and styled correctly, but clicking it does nothing. Check these in order:

1. **Is there an `onClick` handler at all?**
   - Look for buttons with no `onClick`, or an `onClick` that was left as a placeholder (e.g. `onClick={() => {}}` or `onClick={() => console.log(...)}`).
2. **Is the handler actually wired to the right function?**
   - Confirm the function passed to `onClick` is the correct one (not a typo'd name, not an unrelated handler copy-pasted from elsewhere).
   - Confirm the function is defined in scope (not undefined due to a bad import or wrong component).
3. **Is the click being blocked?**
   - Check for an overlapping element (invisible div, modal backdrop, absolutely positioned element) sitting on top of the button and intercepting the click.
   - Check `disabled` or `pointer-events: none` isn't accidentally applied.
   - Check `z-index` — the button might be visually on top but functionally behind another element.
4. **Does the handler update state correctly?**
   - For **Add** buttons: confirm the new item is actually appended to the array/state (common bug: mutating state directly instead of creating a new array/object, e.g. `items.push(x)` instead of `setItems([...items, x])`).
   - For **Delete** buttons: confirm the correct item's ID/index is passed to the delete handler (common bug: deleting by index when the list has been filtered/sorted, so the wrong item gets removed).
   - For **Edit/Update** buttons: confirm the form/local state is synced with the item being edited, and the save handler writes back to the right ID.
5. **Is the state update reaching the UI?**
   - Confirm the component re-renders after state changes (check that state lives in the right component, not a stale local copy).
   - If using a global store/context, confirm the button dispatches to it correctly and the consuming component subscribes to it.
6. **Any silent errors?**
   - Check the browser console for errors that fire on click (e.g. "Cannot read properties of undefined") — these often kill the rest of the handler silently.

**Quick test after fixing:** click the button multiple times in a row (fast) and check for duplicate entries, and test Add + Delete + Edit together to confirm they don't clobber each other's state.

### Step 4 — Fix UI Bugs
Check for these common issues:
- **Fixed but shifted**: on Bolt.new specifically, watch for Add/Delete actions that work in state but the list doesn't visually update until a re-render is triggered elsewhere — often a missing `key` prop on list items causing React to reuse the wrong DOM node.
- **Overflow/clipping**: content cut off by `overflow: hidden`, fixed widths, or missing `min-width: 0` on flex children.
- **Responsiveness**: test at mobile (375px), tablet (768px), and desktop (1280px+) breakpoints. Look for fixed pixel widths that should be `%`, `max-w-*`, or `flex`/`grid`.
- **Alignment/spacing**: inconsistent padding/margin, misaligned flex/grid items, missing `gap`.
- **Z-index conflicts**: modals, dropdowns, or tooltips hidden behind other elements.
- **Contrast/readability**: text failing against backgrounds, especially in dark mode.
- **Interactive states**: missing hover/focus/active/disabled states, no loading or empty states.

### Step 5 — Verify the Fix
1. Re-check the specific bug that was reported — confirm it no longer occurs.
2. Check that the fix didn't break anything else (adjacent components, other breakpoints, other pages using the same component).
3. Test at multiple screen sizes if the fix touched layout/CSS.
4. If the fix involved a button, click it repeatedly and in combination with related buttons (Add then Delete then Edit) to confirm no state corruption.

### Step 6 — Explain the Fix
Give a short, plain-language summary:
- What was broken and why (root cause, not just symptom)
- What was changed
- What to test to confirm it's resolved

### Output style
- Keep explanations concise — a short "what broke / why / what changed" summary, not a full essay.
- Show the corrected code, not just a description of the fix.
- Flag any other bugs/UI issues noticed nearby, even if not explicitly asked about.
