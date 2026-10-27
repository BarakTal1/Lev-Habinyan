# Design critique: Lev HaBinyan (Track A)

Date: 2026-10-27. Reviewed on the live site, phone width (375 px) first.
Frameworks used: design critique (first impression, hierarchy, consistency, accessibility) and the UI/UX checklist.

## Overall impression

The app was already clean and well built. Motion, press states and focus rings show care.
The visual language was generic, though. It looked like any task app: beige canvas, white rounded cards, identical icon tiles, pill badges, a row of three stat tiles.
Nothing said "building" or "Israel". The managers could not tell it apart from a template.

## What made it look generic ("AI slop" tells)

| Tell | Where | Why it hurts |
|---|---|---|
| The same icon tile on every row | Today, tickets | Every fault had the same exclamation icon. It carried no information. |
| A badge on every row | Today, tickets | Most tickets use the default urgency `חשוב`. A badge on the default is noise and hides the real exceptions. |
| Amber chip `N שעות ללא טיפול` on every fault | Today, tickets | Loud, repeated, and in hours. People read days. |
| Three stat tiles (red, blue, white) | Today | The classic dashboard opener. The `היום 0` tile was empty. The tiles did not say what to do first. |
| A greeting as the main heading | Today | `בוקר טוב` tells nothing. The first line should say what needs attention. |
| Soft double shadows on every card | All screens | Floating cards everywhere flatten the hierarchy. |
| One sans font for everything | All screens | No typographic voice. |
| A grid of identical grey `?` circles | Maintenance | A wall of question marks hid the few real alerts. |
| The same building icon on every building | Buildings | Five identical tiles. The building has no identity. |
| An icon inside every badge, including `NEW` | Ticket page | Decoration. The `fiber_new` glyph even spelled "NEW" in an English word inside a Hebrew UI. |

## What changed

1. **Building name as text.** A house-number plaque was tried and removed. Two buildings can share a number on different streets, and the plaque would look the same for both. Each row now shows the full address above the title.
2. **Badges show exceptions only.** The default urgency has no badge. `חשוב מאוד`, `דחוף` and `סכנה` keep a badge and get a colored edge mark on the row. Status and maintenance badges are text only.
3. **Wait time in plain text.** The amber chip is now one red line, in days after 48 hours (`5 ימים ללא טיפול`).
4. **A headline, not tiles.** The Today screen now opens with the one thing that matters: `3 תקלות דחופות מחכות לטיפול`. Counts sit in one quiet line below. The greeting moved to a small line above.
5. **Titles.** A serif title (Frank Ruhl Libre) was tried and removed after review. Titles use Heebo 800 with tight tracking.
6. **Flat cards.** Hairline borders replace the floating shadows.
7. **Calm "no data".** The maintenance grid shows a hollow dot for missing data. Only real states (ok, soon, overdue) use color, so alerts stand out.

## What works well (kept)

- Press feedback, sheet motion and reduced-motion support.
- Color is never the only signal (text and icons for state).
- Touch targets of 48 px and a bottom bar with labels.
- RTL layout and Hebrew-first copy.
- The navy and warm beige palette fits the logo.

## Accessibility check

- Danger text `#B3261E` on white is about 6.5:1. Pass.
- The muted text `#5B6478` on `#F7F5F0` is about 5.6:1. Pass.
- The plaque is decorative (`aria-hidden`). The address text is still in the row.
- Edge marks are decorative. The urgency badge text carries the meaning.
- Not tested: dark mode (the app has none), VoiceOver and TalkBack.

## Remaining opportunities (not done)

1. **Category icons.** Use elevator, bolt, water and key icons by category instead of one report icon. Needs the category on the Today rows.
2. **Ticket page.** The big `העברה ל: בטיפול` button and the status dropdown repeat each other. Keep one primary action and move the dropdown to a menu.
3. **More page.** A plain list. Group it (Operations, People, Setup) and show counts.
4. **Building page overview.** Still two numbers and two outline buttons. Add the open faults list and the next three maintenance dates.
5. **Empty states.** `הכל מסודר` has a check icon only. Add one line on what to do next.
6. **Dark mode.** Design the light and dark themes together.
7. **Filter chips.** The chip row hides items off screen with no cue (same as the maintenance grid).
