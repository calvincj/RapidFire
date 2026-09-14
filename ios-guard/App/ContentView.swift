import SwiftUI
import FamilyControls

struct ContentView: View {
    @StateObject private var screenTime = ScreenTimeManager.shared
    @State private var selection = AppGroupStore.shared.loadSelection() ?? FamilyActivitySelection()
    @State private var hasConfiguredApps = AppGroupStore.shared.loadSelection() != nil
    @State private var streak = AppGroupStore.shared.currentStreak()

    // TODO: point this at your deployed RapidFire URL (the Vercel production URL).
    private let rapidFireURL = URL(string: "https://YOUR-RAPIDFIRE-URL.vercel.app")!

    var body: some View {
        Group {
            if screenTime.authorizationStatus != .approved {
                OnboardingAuthView()
            } else if !hasConfiguredApps {
                OnboardingPickerView(selection: $selection) {
                    AppGroupStore.shared.saveSelection(selection)
                    ScreenTimeManager.shared.startDailySchedule()
                    ScreenTimeManager.shared.applyShieldIfNotCompletedToday()
                    hasConfiguredApps = true
                }
            } else {
                RapidFireWebView(url: rapidFireURL) {
                    streak = ScreenTimeManager.shared.markTodayCompleteAndLiftShield()
                }
                .ignoresSafeArea()
                .overlay(alignment: .top) {
                    if streak > 0 {
                        Text("🔥 \(streak)-day streak")
                            .font(.caption.bold())
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .background(.ultraThinMaterial, in: Capsule())
                            .padding(.top, 8)
                    }
                }
            }
        }
        .task {
            // Keep the schedule alive across launches (idempotent — cheap to call repeatedly).
            if screenTime.authorizationStatus == .approved && hasConfiguredApps {
                ScreenTimeManager.shared.startDailySchedule()
            }
        }
    }
}

private struct OnboardingAuthView: View {
    @ObservedObject private var screenTime = ScreenTimeManager.shared

    var body: some View {
        VStack(spacing: 16) {
            Text("🗞️").font(.system(size: 56))
            Text("RapidFire Guard").font(.title.bold())
            Text("Needs Screen Time permission to block distracting apps until you've read today's digest.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                Task { await screenTime.requestAuthorization() }
            } label: {
                Text("Grant Screen Time Access")
                    .font(.headline)
                    .padding(.horizontal, 20).padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
        }
    }
}

private struct OnboardingPickerView: View {
    @Binding var selection: FamilyActivitySelection
    @State private var showPicker = false
    let onConfirm: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("🚫").font(.system(size: 56))
            Text("Pick apps to block").font(.title.bold())
            Text("These stay locked every morning until you finish today's RapidFire digest.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button { showPicker = true } label: {
                Text(selection.applicationTokens.isEmpty ? "Choose Apps" : "\(selection.applicationTokens.count) app(s) selected")
                    .font(.headline)
                    .padding(.horizontal, 20).padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
            .familyActivityPicker(isPresented: $showPicker, selection: $selection)

            if !selection.applicationTokens.isEmpty {
                Button("Start Blocking", action: onConfirm)
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 8)
            }
        }
    }
}
