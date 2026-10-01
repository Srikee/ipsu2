# cordova-plugin-ipsu-deeplink

Custom deeplink plugin for Ionic/Cordova.

Package name: `cordova-plugin-ipsu-deeplink`

JavaScript API name: `IpsuDeeplink`

## Install

```text
cordova plugin add ./cordova-plugin-ipsu-deeplink \
  --variable URL_SCHEME=ipsu \
  --variable DEEPLINK_SCHEME=https \
  --variable DEEPLINK_HOST=ipsu.pn.psu.ac.th \
  --variable ANDROID_PATH_PREFIX=/callback
```

Recommended for Android:

```xml
<preference name="AndroidLaunchMode" value="singleTask" />
```

## Ionic example

```ts
declare const IpsuDeeplink: any;

async function initDeepLink() {
  IpsuDeeplink.onOpenUrl((url: string) => {
    handleDeepLink(url);
  });

  const url = await IpsuDeeplink.getInitialUrlPromise();
  if (url) {
    handleDeepLink(url);
    IpsuDeeplink.clearInitialUrl();
  }
}

function handleDeepLink(url: string) {
  console.log('Deep link:', url);
}
```

## Test on iOS Simulator

```text
xcrun simctl openurl booted "ipsu://callback?code=test&state=test"
```

## API

- `IpsuDeeplink.onOpenUrl(callback)`
- `IpsuDeeplink.getInitialUrl(success, error)`
- `IpsuDeeplink.getInitialUrlPromise()`
- `IpsuDeeplink.clearInitialUrl(success, error)`

## Notes

Version 0.4.1 keeps the v0.4.0 duplicate-delivery guard for cold start. One URL should be delivered one time only.
