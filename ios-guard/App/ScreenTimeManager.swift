import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

@MainActor
final class ScreenTimeManager: ObservableObject {
    static let shared = ScreenTimeManager()

    @Published var authorizationStatus: AuthorizationStatus = .notDetermined

    private let store = ManagedSettingsStore()
    private let deviceActivityCenter = DeviceActivityCenter()
    private let scheduleName = DeviceActivityName("dailyDigestGate")

    private init() {
        authorizationStatus = AuthorizationCenter.shared.authorizationStatus
    }

    // MARK: - Authorization

    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            authorizationStatus = AuthorizationCenter.shared.authorizationStatus
        } catch {
            print("[ScreenTimeManager] Authorization failed: \(error)")
        }
    }

    // MARK: - Daily schedule

    /// Starts (or restarts) the recurring window that the ShieldMonitor extension wakes up for.
    /// It re-applies the shield every day at `startHour` unless today is already marked complete.
    /// `intervalDidEnd` (end of day) always lifts the shield as a safety valve, so a bug can never
    /// lock you out for more than one day.
    func startDailySchedule(startHour: Int = 5) {
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: startHour, minute: 0),
            intervalEnd: DateComponents(hour: 23, minute: 59),
            repeats: true
        )
        do {
            try deviceActivityCenter.startMonitoring(scheduleName, during: schedule)
        } catch {
            print("[ScreenTimeManager] Failed to start monitoring: \(error)")
        }
    }

    // MARK: - Shield control (also called directly from the extension via the same App Group)

    /// Applies the shield immediately if today isn't already marked complete. Call this right
    /// after onboarding so blocking starts without waiting for the next scheduled interval.
    func applyShieldIfNotCompletedToday() {
        guard !AppGroupStore.shared.isCompletedToday() else { return }
        guard let selection = AppGroupStore.shared.loadSelection() else { return }
        store.shield.applications = selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    }

    func liftShield() {
        store.shield.applications = nil
    }

    /// Called from the WebView bridge when the digest is fully read.
    @discardableResult
    func markTodayCompleteAndLiftShield() -> Int {
        let streak = AppGroupStore.shared.markCompletedToday()
        liftShield()
        return streak
    }
}
