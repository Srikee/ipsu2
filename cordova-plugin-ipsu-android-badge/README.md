# iPSU Android unread badge

This Android-only Cordova plugin registers a OneSignal v5 Notification Service Extension. It reads `data.unread_count` from each incoming push and passes it to Android's `NotificationCompat.Builder.setNumber()`. The extension runs without the Ionic WebView, including when the app is in the background or its process has been closed normally.

The PHP push sender is in a separate repository. **This app change requires the sender to include the current per-user total** of unread `task + alert + message` items in each OneSignal push. For example:

```json
{
  "app_id": "YOUR_ONESIGNAL_APP_ID",
  "include_aliases": { "external_id": ["USERNAME"] },
  "target_channel": "push",
  "contents": { "en": "You have a new message" },
  "data": { "unread_count": 2, "route": "/tabs/message" }
}
```

Calculate `unread_count` **after** saving the new message for this recipient. It is the same total returned by `message-list.php` in `meta.counts`, summed across `task`, `alert`, and `message`. Send each recipient's own count rather than a broadcast value. Do not increment a local counter for each push. A missing or invalid count leaves the notification unchanged.

Install dependencies with `npm ci`, then run `cordova prepare android` or add the Android platform as usual. The plugin is referenced from `package.json` and is installed during Cordova preparation. iOS does not use this plugin.

## Limits and device test

Android launchers choose how to render badges. `setNumber(2)` provides the count on an active notification, but a launcher may show a dot or count active notifications instead. A push carrying `unread_count: 0` cannot clear previously posted Android notifications by setting their number to zero. Synchronizing decreases or zero while the app stays closed requires a separate server-triggered notification-tray update; the PHP sender is needed to implement and test that end-to-end.

On a real Android device with badge notifications allowed, send a push with `data.unread_count = 2` to a logged-in test account while iPSU is closed normally. Check the notification and icon before opening iPSU, then compare the in-app count after opening. Repeat on the target launcher; do not use Android Settings > Force stop for this test.
