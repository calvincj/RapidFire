# RapidFire Guard — setup

A thin native iOS wrapper that loads the real RapidFire web app in a `WKWebView`, and uses
Apple's Screen Time / Family Controls APIs to shield chosen apps (Instagram, TikTok, Safari,
whatever you pick) every morning until you've swiped through the whole digest in Swipe mode.
Nothing about the reading experience itself changes — it's the exact same Next.js app, just
loaded inside a native shell that can also lock your phone.

**I wrote all the Swift code here, but this machine has no Xcode (only Command Line Tools) — no
iOS SDK, no simulator, no way for me to compile or test any of it.** Treat this as a strong first
draft, not verified-working code. Expect to fix a handful of small build errors the first time you
open it in real Xcode — send me whatever Xcode's error panel says and I'll fix it from there.

## 0. Do this first

Correcting what an earlier draft of this doc said: there is **no Apple approval form to wait on**
for your use case, and no request to submit. `Family Controls` actually has two separate
entitlements:

- **Development** — what you need. Works immediately in Xcode, zero approval process, zero
  waiting on Apple. **But it requires a paid Apple Developer Program membership ($99/yr)** — a
  free Apple ID ("Personal Team" in Xcode) cannot use Family Controls at all; the capability won't
  even appear in Xcode's capability list for a free account, full stop.
- **Distribution** — the one that needs Apple's review/approval form. Only required for shipping
  to TestFlight or the App Store. You're sideloading to your own phone only, so **you never need
  this one**.

So: **go pay for an Apple Developer Program membership** at
[developer.apple.com/programs](https://developer.apple.com/programs) if you don't already have
one, under the Apple ID you'll build with. That's it — no waiting period, no form, no approval
gate. Once it's active you can move straight to step 1.

## 1. Create the Xcode project

Don't try to open these files directly — hand-building an `.xcodeproj` from text is fragile.
Instead:

1. Xcode → File → New → Project → iOS → **App**.
2. Product Name: `RapidFireGuard`. Interface: **SwiftUI**. Language: **Swift**.
3. Save it anywhere — e.g. right here in `ios-guard/RapidFireGuard/`.
4. Delete the placeholder `ContentView.swift` and `RapidFireGuardApp.swift` Xcode generated —
   you'll replace them with the ones in `ios-guard/App/`.

## 2. Add the App Group (shared storage between the app and the extension)

1. Select the `RapidFireGuard` target → **Signing & Capabilities** → **+ Capability** → **App Groups**.
2. Click **+**, create `group.com.calvin.rapidfireguard` (or your own reverse-DNS id — if you
   change it, update it in `AppGroupStore.swift`, both entitlements files, and the extension's
   capability in step 4).

## 3. Add the Family Controls capability

1. Same target → **+ Capability** → search "Family Controls" → add it.
   (This is what actually writes the `com.apple.developer.family-controls` entitlement — the
   `.entitlements` files in this folder are reference copies of what Xcode should generate; let
   Xcode manage the real one once the capability is added, rather than swapping in mine directly.)

## 4. Add the DeviceActivityMonitor extension target

1. File → New → Target → **Device Activity Monitor Extension**.
2. Name it `ShieldMonitor`.
3. On the new `ShieldMonitor` target: **Signing & Capabilities** → add the same **App Group**
   (`group.com.calvin.rapidfireguard`) and the same **Family Controls** capability as the main app.
4. Delete the placeholder extension file Xcode generated, you'll use
   `ios-guard/ShieldMonitor/ShieldMonitorExtension.swift` instead.

## 5. Add the source files

Drag these into the project (uncheck "Copy items if needed" is fine either way, just make sure
target membership is right):

| File | Target(s) |
|---|---|
| `App/RapidFireGuardApp.swift` | RapidFireGuard |
| `App/ContentView.swift` | RapidFireGuard |
| `App/RapidFireWebView.swift` | RapidFireGuard |
| `App/ScreenTimeManager.swift` | RapidFireGuard |
| `App/AppGroupStore.swift` | **both** RapidFireGuard and ShieldMonitor (check both boxes in the File Inspector's Target Membership — the extension needs this file too) |
| `ShieldMonitor/ShieldMonitorExtension.swift` | ShieldMonitor |

## 6. Point it at your deployed app

In `ContentView.swift`, replace:

```swift
private let rapidFireURL = URL(string: "https://YOUR-RAPIDFIRE-URL.vercel.app")!
```

with your actual Vercel production URL.

One more thing worth doing: have the URL open directly into Swipe mode (e.g. a `?mode=swipe`
query param the web app reads on load) so the native shell always lands on the Reels-style feed,
since that's the only place the completion signal fires. Tell me if you want that query-param
handling added to `DigestClient.tsx` — it's a small change.

## 7. Info.plist additions

Add this key to the main app's `Info.plist` (Xcode may prompt for it automatically when you add
the Family Controls capability — if not, add manually):

```xml
<key>NSFamilyControlsUsageDescription</key>
<string>Blocks distracting apps each morning until you've read your RapidFire digest.</string>
```

## 8. Build and run to your phone

1. Connect your iPhone via USB (or same-WiFi wireless debugging).
2. Select your device as the run destination (not a simulator — Family Controls doesn't work in
   the simulator).
3. In Xcode's Signing settings, select your **paid Developer Program team** (not "Personal Team")
   for both the app target and the ShieldMonitor target, and let Xcode auto-manage signing.
4. On your phone: Settings → General → VPN & Device Management → trust your developer certificate
   the first time.
5. Hit Run. First launch will prompt for Screen Time permission, then let you pick which apps to
   shield.

## If something goes wrong / you need the emergency exit

You are never permanently locked out — Settings → Screen Time → [find RapidFireGuard] → revoke
its authorization, or just delete the app, immediately clears any shield it set. The
`intervalDidEnd` safety valve in `ShieldMonitorExtension.swift` also auto-clears the shield at
23:59 every day regardless of whether you completed the digest, so a bug can cost you at most one
day, never a hard lockout.

## What I couldn't verify from here

- That the Swift actually compiles against the real SDKs (no Xcode on this machine).
- The Development-vs-Distribution entitlement split above is corroborated across Apple's own
  forums and several independent write-ups as of this writing, but I couldn't load Apple's actual
  doc pages directly to quote them verbatim (they didn't return real content to my fetch tool) —
  if Xcode's capability list behaves differently than described, that's the ground truth, not this
  doc.
- Whether `ShieldSettings` behavior matches current iOS exactly — Apple has changed some of these
  APIs across iOS versions; if `store.shield.applications` or `FamilyActivitySelection`'s field
  names have shifted on your iOS/Xcode version, Xcode's autocomplete/error messages will tell you
  the current names and I can patch it quickly.
