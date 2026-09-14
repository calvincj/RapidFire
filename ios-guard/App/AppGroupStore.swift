import Foundation
import FamilyControls

/// Shared storage between the main app and the ShieldMonitor extension (they run as separate
/// processes, so UserDefaults.standard would NOT be shared — an App Group container is required).
///
/// ⚠️ Set `appGroupID` below to match the App Group you create in Xcode (Signing & Capabilities →
/// "+ App Group" on BOTH the main app target and the ShieldMonitor extension target — they must
/// use the exact same identifier, e.g. "group.com.<yourname>.rapidfireguard").
struct AppGroupStore {
    static let shared = AppGroupStore()

    private let appGroupID = "group.com.calvin.rapidfireguard" // TODO: match your App Group ID

    private var defaults: UserDefaults {
        guard let d = UserDefaults(suiteName: appGroupID) else {
            fatalError("App Group '\(appGroupID)' is not configured — check Signing & Capabilities on both targets.")
        }
        return d
    }

    private let selectionKey = "familyActivitySelection"
    private let lastCompletedDateKey = "lastCompletedDate" // "yyyy-MM-dd", local time
    private let streakKey = "streakCount"

    // MARK: - Which apps to shield

    func saveSelection(_ selection: FamilyActivitySelection) {
        if let data = try? JSONEncoder().encode(selection) {
            defaults.set(data, forKey: selectionKey)
        }
    }

    func loadSelection() -> FamilyActivitySelection? {
        guard let data = defaults.data(forKey: selectionKey) else { return nil }
        return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }

    // MARK: - Daily completion + streak

    /// Call once, when the web app reports the digest is fully read.
    /// Returns the new streak count.
    @discardableResult
    func markCompletedToday() -> Int {
        let today = Self.dateString(for: Date())
        if defaults.string(forKey: lastCompletedDateKey) == today {
            return defaults.integer(forKey: streakKey) // already recorded today, no double-count
        }
        let previousStreak = defaults.integer(forKey: streakKey)
        let yesterday = Self.dateString(for: Calendar.current.date(byAdding: .day, value: -1, to: Date()) ?? Date())
        let wasStreakAlive = defaults.string(forKey: lastCompletedDateKey) == yesterday
        let newStreak = wasStreakAlive ? previousStreak + 1 : 1
        defaults.set(today, forKey: lastCompletedDateKey)
        defaults.set(newStreak, forKey: streakKey)
        return newStreak
    }

    func isCompletedToday() -> Bool {
        defaults.string(forKey: lastCompletedDateKey) == Self.dateString(for: Date())
    }

    func currentStreak() -> Int {
        defaults.integer(forKey: streakKey)
    }

    static func dateString(for date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: date)
    }
}
