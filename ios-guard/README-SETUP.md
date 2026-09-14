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

## 0. Do this first — it's the longest pole

`Family Controls` is a **restricted entitlement**. Even to sideload an app to your own phone
(no App Store involved), Apple requires you to request access to it:

1. Go to [developer.apple.com/contact/request/family-controls-distribution](https://developer.apple.com/contact/request/family-controls-distribution) (or search
   "Family Controls entitlement request" if that URL has moved) and submit the request under your
   Apple Developer account. A free Apple ID works for local sideloading, but you may find the
   entitlement request flow itself expects a paid Apple Developer Program membership ($99/yr) —
   if the free-account request is rejected or the page doesn't let you submit, that's likely why.
2. This can take anywhere from same-day to a couple of weeks. **Do this now, then come back** —
   everything else below can be done while you wait, but you can't actually run the shield without
   this being approved.

If it gets denied for an individual/non-App-Store use case, tell me and we'll fall back to the
Screen Time Downtime approach instead (weaker, but zero-dependency).

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
3. In Xcode's Signing settings, select your Apple ID as the team, let it auto-manage signing.
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
- The exact current shape of the Family Controls entitlement request process/timeline.
- Whether `ShieldSettings` behavior matches current iOS exactly — Apple has changed some of these
  APIs across iOS versions; if `store.shield.applications` or `FamilyActivitySelection`'s field
  names have shifted on your iOS/Xcode version, Xcode's autocomplete/error messages will tell you
  the current names and I can patch it quickly.
