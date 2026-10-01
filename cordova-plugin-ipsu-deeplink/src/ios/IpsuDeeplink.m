#import "IpsuDeeplink.h"
#import <Cordova/CDVPluginResult.h>
#import <Cordova/CDVPluginNotifications.h>

static NSString * const IpsuDeeplinkLastUrlKey = @"IpsuDeeplink.lastUrl";
static NSString * const IpsuDeeplinkOpenURLNotification = @"IpsuDeeplinkOpenURLNotification";

@interface IpsuDeeplink ()
@property (nonatomic, copy) NSString *callbackId;
@property (nonatomic, copy) NSString *lastUrl;
@property (nonatomic, copy) NSString *lastEmittedUrl;
@property (nonatomic, assign) NSTimeInterval lastEmitAt;
@end

@implementation IpsuDeeplink

- (void)pluginInitialize {
    [super pluginInitialize];

    self.lastUrl = [[NSUserDefaults standardUserDefaults] stringForKey:IpsuDeeplinkLastUrlKey];

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleOpenURLNotification:)
                                                 name:CDVPluginHandleOpenURLNotification
                                               object:nil];

    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(handleOpenURLNotification:)
                                                 name:IpsuDeeplinkOpenURLNotification
                                               object:nil];
}

- (void)dispose {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
    [super dispose];
}

- (void)subscribe:(CDVInvokedUrlCommand *)command {
    self.callbackId = command.callbackId;

    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_NO_RESULT];
    [result setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];

    NSString *pending = self.lastUrl ?: [[NSUserDefaults standardUserDefaults] stringForKey:IpsuDeeplinkLastUrlKey];
    if (pending.length > 0) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.15 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [self emitUrl:pending];
        });
    }
}

- (void)getInitialUrl:(CDVInvokedUrlCommand *)command {
    NSString *url = self.lastUrl ?: [[NSUserDefaults standardUserDefaults] stringForKey:IpsuDeeplinkLastUrlKey] ?: @"";
    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:url];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)clearInitialUrl:(CDVInvokedUrlCommand *)command {
    self.lastUrl = nil;
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:IpsuDeeplinkLastUrlKey];
    [[NSUserDefaults standardUserDefaults] synchronize];

    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK];
    [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
}

- (void)handleOpenURLNotification:(NSNotification *)notification {
    NSURL *url = nil;

    if ([notification.object isKindOfClass:[NSURL class]]) {
        url = (NSURL *)notification.object;
    } else if ([notification.object isKindOfClass:[NSString class]]) {
        url = [NSURL URLWithString:(NSString *)notification.object];
    }

    if (url == nil) {
        id userInfoUrl = notification.userInfo[@"url"];
        if ([userInfoUrl isKindOfClass:[NSURL class]]) {
            url = userInfoUrl;
        } else if ([userInfoUrl isKindOfClass:[NSString class]]) {
            url = [NSURL URLWithString:(NSString *)userInfoUrl];
        }
    }

    if (url == nil) {
        return;
    }

    NSString *absolute = url.absoluteString;
    if (absolute.length == 0) {
        return;
    }

    self.lastUrl = absolute;
    [[NSUserDefaults standardUserDefaults] setObject:absolute forKey:IpsuDeeplinkLastUrlKey];
    [[NSUserDefaults standardUserDefaults] synchronize];

    [self emitUrl:absolute];
}

- (void)emitUrl:(NSString *)url {
    if (self.callbackId.length == 0 || url.length == 0) {
        return;
    }

    NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
    if ([self.lastEmittedUrl isEqualToString:url] && (now - self.lastEmitAt) < 0.35) {
        return;
    }

    self.lastEmittedUrl = url;
    self.lastEmitAt = now;

    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsString:url];
    [result setKeepCallbackAsBool:YES];
    [self.commandDelegate sendPluginResult:result callbackId:self.callbackId];
}

@end
