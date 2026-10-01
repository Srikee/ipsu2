#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <objc/runtime.h>

static NSString * const IpsuDeeplinkLastUrlKey = @"IpsuDeeplink.lastUrl";
static NSString * const IpsuDeeplinkOpenURLNotification = @"IpsuDeeplinkOpenURLNotification";
static NSString * const IpsuDeeplinkOriginalIMPKeyPrefix = @"IpsuDeeplink.originalIMP.";

static NSString *IpsuKeyFor(Class cls, SEL selector) {
    return [NSString stringWithFormat:@"%@|%@", NSStringFromClass(cls), NSStringFromSelector(selector)];
}

static NSMutableDictionary<NSString *, NSValue *> *IpsuOriginalIMPs(void) {
    static NSMutableDictionary<NSString *, NSValue *> *store;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        store = [NSMutableDictionary dictionary];
    });
    return store;
}

static IMP IpsuFindOriginalIMP(id self, SEL selector) {
    Class cls = object_getClass(self);
    while (cls != Nil) {
        NSValue *value = IpsuOriginalIMPs()[IpsuKeyFor(cls, selector)];
        if (value != nil) {
            return [value pointerValue];
        }
        cls = class_getSuperclass(cls);
    }
    return NULL;
}

static BOOL IpsuClassDirectlyImplementsSelector(Class cls, SEL selector) {
    unsigned int count = 0;
    Method *methods = class_copyMethodList(cls, &count);
    BOOL found = NO;

    for (unsigned int i = 0; i < count; i++) {
        if (method_getName(methods[i]) == selector) {
            found = YES;
            break;
        }
    }

    if (methods != NULL) {
        free(methods);
    }
    return found;
}

static void IpsuStoreAndNotifyURL(NSURL *url, NSDictionary *userInfo) {
    if (url == nil || url.absoluteString.length == 0) {
        return;
    }

    NSString *absolute = url.absoluteString;
    [[NSUserDefaults standardUserDefaults] setObject:absolute forKey:IpsuDeeplinkLastUrlKey];
    [[NSUserDefaults standardUserDefaults] synchronize];

    NSMutableDictionary *info = [NSMutableDictionary dictionary];
    info[@"url"] = absolute;
    if (userInfo != nil) {
        [info addEntriesFromDictionary:userInfo];
    }

    // Use our own notification only. Do not post CDVPluginHandleOpenURLNotification here,
    // because Cordova's CDVHandleOpenURL may also evaluate JavaScript and can cause duplicate
    // handling / warnings when the app is not fully ready.
    [[NSNotificationCenter defaultCenter] postNotificationName:IpsuDeeplinkOpenURLNotification
                                                        object:absolute
                                                      userInfo:info];
}

static BOOL IpsuApplicationOpenURL(id self, SEL _cmd, UIApplication *application, NSURL *url, NSDictionary<UIApplicationOpenURLOptionsKey,id> *options) {
    IpsuStoreAndNotifyURL(url, options);

    IMP original = IpsuFindOriginalIMP(self, _cmd);
    if (original != NULL) {
        BOOL (*typedOriginal)(id, SEL, UIApplication *, NSURL *, NSDictionary *) = (void *)original;
        BOOL handled = typedOriginal(self, _cmd, application, url, options);
        return handled || (url != nil);
    }

    return url != nil;
}

static BOOL IpsuApplicationContinueUserActivity(id self, SEL _cmd, UIApplication *application, NSUserActivity *userActivity, void (^restorationHandler)(NSArray * _Nullable)) {
    NSURL *url = userActivity.webpageURL;
    IpsuStoreAndNotifyURL(url, @{ @"activityType": userActivity.activityType ?: @"" });

    IMP original = IpsuFindOriginalIMP(self, _cmd);
    if (original != NULL) {
        BOOL (*typedOriginal)(id, SEL, UIApplication *, NSUserActivity *, void (^)(NSArray * _Nullable)) = (void *)original;
        BOOL handled = typedOriginal(self, _cmd, application, userActivity, restorationHandler);
        return handled || (url != nil);
    }

    return url != nil;
}

static void IpsuSceneOpenURLContexts(id self, SEL _cmd, UIScene *scene, NSSet<UIOpenURLContext *> *URLContexts) API_AVAILABLE(ios(13.0)) {
    NSURL *url = URLContexts.anyObject.URL;
    IpsuStoreAndNotifyURL(url, nil);

    IMP original = IpsuFindOriginalIMP(self, _cmd);
    if (original != NULL) {
        void (*typedOriginal)(id, SEL, UIScene *, NSSet<UIOpenURLContext *> *) = (void *)original;
        typedOriginal(self, _cmd, scene, URLContexts);
    }
}

static void IpsuSceneContinueUserActivity(id self, SEL _cmd, UIScene *scene, NSUserActivity *userActivity) API_AVAILABLE(ios(13.0)) {
    NSURL *url = userActivity.webpageURL;
    IpsuStoreAndNotifyURL(url, @{ @"activityType": userActivity.activityType ?: @"" });

    IMP original = IpsuFindOriginalIMP(self, _cmd);
    if (original != NULL) {
        void (*typedOriginal)(id, SEL, UIScene *, NSUserActivity *) = (void *)original;
        typedOriginal(self, _cmd, scene, userActivity);
    }
}

static void IpsuInstallOrReplace(Class cls, SEL selector, IMP replacement, const char *types) {
    if (cls == Nil || selector == NULL || replacement == NULL || types == NULL) {
        return;
    }

    // Prevent double swizzling. This is important when both CDVSceneDelegate and app SceneDelegate
    // are present or when the simulator reloads classes during debug builds.
    NSString *key = IpsuKeyFor(cls, selector);
    if (IpsuOriginalIMPs()[key] != nil) {
        return;
    }

    Method method = class_getInstanceMethod(cls, selector);
    BOOL directlyImplements = IpsuClassDirectlyImplementsSelector(cls, selector);

    if (method != NULL && directlyImplements) {
        IMP original = method_getImplementation(method);
        IpsuOriginalIMPs()[key] = [NSValue valueWithPointer:original];
        class_replaceMethod(cls, selector, replacement, types);
        return;
    }

    // If the class does not implement the selector at all, add our handler.
    // If it only inherits the selector, let the superclass hook handle it to avoid duplicate calls.
    if (method == NULL) {
        class_addMethod(cls, selector, replacement, types);
    }
}

@interface IpsuDeeplinkHooks : NSObject
@end

@implementation IpsuDeeplinkHooks

+ (void)load {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // Install immediately so cold-start URLs are not missed before the main queue runs.
        [self installHooks];

        // Install again after launch in case a Swift delegate class was registered slightly later.
        dispatch_async(dispatch_get_main_queue(), ^{
            [self installHooks];
        });
    });
}

+ (void)installHooks {
    NSArray<NSString *> *candidateNames = @[
        @"AppDelegate",
        @"SceneDelegate",
        @"CDVAppDelegate",
        @"CDVSceneDelegate"
    ];

    NSMutableSet<Class> *candidates = [NSMutableSet set];

    for (NSString *name in candidateNames) {
        Class cls = NSClassFromString(name);
        if (cls != Nil) {
            [candidates addObject:cls];
        }
    }

    int count = objc_getClassList(NULL, 0);
    if (count > 0) {
        Class *classes = (__unsafe_unretained Class *)calloc((size_t)count, sizeof(Class));
        if (classes != NULL) {
            count = objc_getClassList(classes, count);
            for (int i = 0; i < count; i++) {
                Class cls = classes[i];
                NSString *name = NSStringFromClass(cls);
                if ([name isEqualToString:@"AppDelegate"] ||
                    [name hasSuffix:@".AppDelegate"] ||
                    [name isEqualToString:@"SceneDelegate"] ||
                    [name hasSuffix:@".SceneDelegate"] ||
                    [name isEqualToString:@"CDVAppDelegate"] ||
                    [name isEqualToString:@"CDVSceneDelegate"]) {
                    [candidates addObject:cls];
                }
            }
            free(classes);
        }
    }

    for (Class cls in candidates) {
        NSString *name = NSStringFromClass(cls);
        BOOL isSceneDelegate = [name isEqualToString:@"SceneDelegate"] ||
                               [name hasSuffix:@".SceneDelegate"] ||
                               [name isEqualToString:@"CDVSceneDelegate"];

        BOOL isAppDelegate = [name isEqualToString:@"AppDelegate"] ||
                             [name hasSuffix:@".AppDelegate"] ||
                             [name isEqualToString:@"CDVAppDelegate"];

        if (isAppDelegate) {
            IpsuInstallOrReplace(cls,
                                  @selector(application:openURL:options:),
                                  (IMP)IpsuApplicationOpenURL,
                                  "B@:@@@");

            IpsuInstallOrReplace(cls,
                                  @selector(application:continueUserActivity:restorationHandler:),
                                  (IMP)IpsuApplicationContinueUserActivity,
                                  "B@:@@@");
        }

        if (isSceneDelegate) {
            if (@available(iOS 13.0, *)) {
                IpsuInstallOrReplace(cls,
                                      @selector(scene:openURLContexts:),
                                      (IMP)IpsuSceneOpenURLContexts,
                                      "v@:@@");

                IpsuInstallOrReplace(cls,
                                      @selector(scene:continueUserActivity:),
                                      (IMP)IpsuSceneContinueUserActivity,
                                      "v@:@@");
            }
        }
    }
}

@end
