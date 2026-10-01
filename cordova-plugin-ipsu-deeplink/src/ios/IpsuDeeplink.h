#import <Cordova/CDV.h>

@interface IpsuDeeplink : CDVPlugin
- (void)subscribe:(CDVInvokedUrlCommand *)command;
- (void)getInitialUrl:(CDVInvokedUrlCommand *)command;
- (void)clearInitialUrl:(CDVInvokedUrlCommand *)command;
@end
