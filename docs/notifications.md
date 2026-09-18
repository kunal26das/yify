# Notifications

Daily picks are enabled under **Preferences → Notifications** after the user grants notification permission. They replace new-arrival alerts rather than adding a second stream. The default time is around 7 PM in the device's local time; users can choose another hour, apply genre/rating filters, keep quiet hours, or turn alerts off.

Each pick opens a real movie. Recommendations alternate saved Watchlist films and catalog discoveries, favor saved genres, omit films marked watched, and avoid recently recommended titles. Notification opens include `notification_kind` in analytics so daily picks can be compared with new-arrival alerts.

## Mobile delivery

Android and iOS keep up to seven dated picks scheduled with the operating system. Opening the app, changing notification preferences or the library, and background refreshes update that queue. Opening Yify suppresses that day's daily pick. Changing the timezone is handled on the next refresh. Turning notifications off cancels queued Yify alerts and unregisters background checks.

Scheduling does not require a new native library or exact-alarm permission. Android may delay a reminder for battery management. Background refreshes are opportunistic, and the queue eventually expires if the app never runs again. Continuous fresh delivery to long-inactive users would require a server push service. A denied OS permission or Android force-stop prevents normal delivery.

## Browser and desktop

Browser notifications require permission and an open Yify tab. A hidden tab can deliver a scheduled pick; a visible page does not show a daily reminder. Browser timers may be throttled. This is not closed-browser Web Push. The desktop renderer uses the same daily queue while running and avoids duplicate new-arrival alerts from its native notifier.

## Verification

The automated tests cover recommendation exclusions, local dates and DST, quiet hours, cancellation during an in-flight refresh, partial delivery failure/retry, permissions and Android channels, notification links, and preference persistence/sync.

For a device check, allow alerts, choose an upcoming hour, and background the app. Open its notification and confirm it lands on the named film. Reopen Yify before a pending reminder and confirm today's pick disappears. Disable alerts and confirm no Yify requests remain queued. Repeat with denied permissions, quiet hours and a timezone change. Test on an installed development or release build; background scheduling is controlled by the operating system.
