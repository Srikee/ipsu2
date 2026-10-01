package com.ipsu.cordova.deeplink;

import android.content.Intent;
import android.net.Uri;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaWebView;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;

public class IpsuDeeplink extends CordovaPlugin {
    private CallbackContext listenerCallback;
    private String lastUrl;
    private long lastEmitAtMs = 0;

    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        Intent intent = cordova.getActivity() != null ? cordova.getActivity().getIntent() : null;
        captureIntent(intent, false);
    }

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if ("subscribe".equals(action)) {
            listenerCallback = callbackContext;
            PluginResult result = new PluginResult(PluginResult.Status.NO_RESULT);
            result.setKeepCallback(true);
            callbackContext.sendPluginResult(result);

            if (lastUrl != null && lastUrl.length() > 0) {
                webView.getView().postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        emitUrl(lastUrl);
                    }
                }, 150);
            }
            return true;
        }

        if ("getInitialUrl".equals(action)) {
            callbackContext.success(lastUrl == null ? "" : lastUrl);
            return true;
        }

        if ("clearInitialUrl".equals(action)) {
            lastUrl = null;
            callbackContext.success();
            return true;
        }

        return false;
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        captureIntent(intent, true);
    }

    private void captureIntent(Intent intent, boolean emit) {
        if (intent == null) {
            return;
        }

        String action = intent.getAction();
        Uri data = intent.getData();

        if (Intent.ACTION_VIEW.equals(action) && data != null) {
            String url = data.toString();
            lastUrl = url;
            if (emit) {
                emitUrl(url);
            }
        }
    }

    private void emitUrl(String url) {
        if (url == null || url.length() == 0 || listenerCallback == null) {
            return;
        }

        long now = System.currentTimeMillis();
        if (url.equals(lastUrl) && (now - lastEmitAtMs) < 350) {
            return;
        }
        lastEmitAtMs = now;

        PluginResult result = new PluginResult(PluginResult.Status.OK, url);
        result.setKeepCallback(true);
        listenerCallback.sendPluginResult(result);
    }
}
