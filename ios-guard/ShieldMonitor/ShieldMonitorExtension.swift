import DeviceActivity
import ManagedSettings

/// Runs in the background (a separate process from the main app) on the schedule started by
/// ScreenTimeManager.startDailySchedule(). Its only job: re-lock the selected apps at the start
/// of each day, and always unlock at day's end as a safety valve so a bug in the main app can
/// never lock you out for more than a single day.
class ShieldMonitorExtension: DeviceActivityMonitor {
    private let store = ManagedSettingsStore()

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)

        guard !AppGroupStore.shared.isCompletedToday() else { return }
        guard let selection = AppGroupStore.shared.loadSelection(), !selection.applicationTokens.isEmpty else { return }

        store.shield.applications = selection.applicationTokens
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        // Safety valve: always clear at end of day, regardless of completion state.
        store.shield.applications = nil
    }
}
