# Porting web screens to the native app

The web app in `../src` is the source of truth. Every screen, sheet, button, label, rule and edge case it has must exist in the app. Same words, same order, same behaviour. Do not drop features, do not invent new ones.

## Imports

- Shared, platform-free logic is imported from the web code, never copied: `@shared/engine/engine`, `@shared/engine/types`, `@shared/engine/tournament`, `@shared/engine/series`, `@shared/stats`, `@shared/backup`, `@shared/playerInfo`, `@shared/voice` (only `parse`).
- App versions of the platform modules live in `src/lib`: `@/lib/store` (same API as web `store.ts`), `@/lib/live`, `@/lib/account`, `@/lib/device` (`deviceId()` is a function here, `canScore`, `movedAway`), `@/lib/voice` (`listen`, `parse`, `voiceSupported`), `@/lib/share` (`shareImage(m, kind)`, `shareText(m)`, `sendText(text)` opens WhatsApp, `copyText(text)`), `@/lib/track`.
- UI kit: `@/ui/ui` has `tw`, `C` (colours), `Txt`, `Press`, `Glow`, `Header`, `LivePill`, `LiveDot`, `Badge`, `BallChip` (prop `onPress`), `Sheet`, `Pill`, `Card` (prop `style`), `PrimaryButton`, `GhostButton`, `Stepper`, `Toggle`, `BottomNav`, `Segmented`, `ConfirmSheet`, `FmtSwitch`, `Page`, `buzz`. Read `src/ui/ui.tsx` first.

## Mapping

- `div` → `View`, any text → `Txt` (never React Native `Text`: `Txt` maps font weight to the Poppins file), `button` → `Press` (or `PrimaryButton` / `GhostButton` / `Pill`), `input` → `TextInput` styled with `tw` and `placeholderTextColor={C.mute}`, `selectionColor={C.sun}`.
- Tailwind classes go through `tw\`...\``. React Native has no `grid`: use `flex-row flex-wrap` with fixed widths, or rows of `flex-1` children. No `place-items`, `ring`, arbitrary `shadow-[...]`, `truncate` (use `numberOfLines={1}`), `tabular-nums` (use `{ fontVariant: ["tabular-nums"] }`), `space-y-*` (use `gap-*`), `env(safe-area-inset-*)`, CSS animations or `hover`.
- Text must be inside `Txt`. A `View` can't hold a bare string.
- `onClick` → `onPress`. `window.open("https://wa.me/?text=...")` → `sendText(text)`. `navigator.clipboard.writeText` → `copyText`. `navigator.vibrate` → `buzz("tap" | "heavy" | "warn")`.
- `window.confirm`/`alert` are not used on web either; keep using `ConfirmSheet`.
- Screens: wrap in `<Page tabs>` when the web screen shows `BottomNav`, otherwise `<Page>`. `Header` handles the status bar inset. Long lists can stay in the `Page` ScrollView.
- Web CSS animations (`roll`, `pop`, `coin-flip`, `live-dot`) → `Animated` from react-native with `useNativeDriver: true`. Keep them short, like the web.
- `.stadium` and `.header-glow` backgrounds → `Glow` or `expo-linear-gradient`.
- Navigation stays the web way: `useStore().go(screen, id?)`. Never import expo-router in a screen.
- Web-only bits with no app meaning: `InstallCard` (drop it), `AdBox` (drop it, ads come later), `track` page views (no-op).

## Done means

- Every element of the web file is present in the port. Diff them side by side before you stop.
- `npx tsc --noEmit` is clean for your files.
- No React Native `Text` imports, no `any`, comments at most 2 lines and only for a non-obvious trap.
