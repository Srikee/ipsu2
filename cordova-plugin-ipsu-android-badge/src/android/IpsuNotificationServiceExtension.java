package com.ipsu.cordova.badge;

import androidx.annotation.Keep;

import com.onesignal.notifications.IDisplayableMutableNotification;
import com.onesignal.notifications.INotificationReceivedEvent;
import com.onesignal.notifications.INotificationServiceExtension;

import org.json.JSONObject;

/** Runs in Android even when the Ionic WebView is not running. */
@Keep
public class IpsuNotificationServiceExtension implements INotificationServiceExtension {
    @Override
    public void onNotificationReceived(INotificationReceivedEvent event) {
        IDisplayableMutableNotification notification = event.getNotification();
        JSONObject data = notification.getAdditionalData();
        if (data == null || !data.has("unread_count")) return;

        Integer count = parseCount(data.opt("unread_count"));
        if (count == null) return;

        // Android only uses this number while a notification is displayed.
        // A value of zero cannot clear other notifications from the tray.
        if (count > 0) {
            notification.setExtender(builder -> builder.setNumber(count));
        }
    }

    private Integer parseCount(Object value) {
        try {
            String text = String.valueOf(value);
            if (!text.matches("[0-9]{1,7}")) return null;
            int count = Integer.parseInt(text);
            return count >= 0 ? count : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
