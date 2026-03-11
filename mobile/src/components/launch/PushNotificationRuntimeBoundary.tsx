import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MOBILE_COPY } from '../../copy/mobileCopy';
import { trackAnalyticsEvent, trackFailureObserved } from '../../services/analytics';
import { getRuntimeConfig } from '../../config/runtime';
import {
  normalizeTrustedPushPayload,
  resolvePushRouteTarget,
  type PushRouteHandlingMode,
  type TrustedPushPayload,
} from '../../services/pushNotificationRouting';
import {
  ensureAndroidNotificationChannel,
  syncPushRegistration,
} from '../../services/pushNotifications';
import { useOptionalSafeAreaInsets } from '../../hooks/useOptionalSafeAreaInsets';
import { useAppTheme } from '../../tokens/theme';
import { ActionButton } from '../actions/ActionButton';
import { TonalPanel } from '../surfaces/TonalPanel';

type ForegroundPushNotice = {
  id: string;
  title: string;
  body: string;
  payload: TrustedPushPayload | null;
  eventType: string;
};

type Props = {
  children: React.ReactNode;
};

function getNotificationIdentifier(notification: Notifications.Notification): string {
  return notification.request.identifier;
}

function extractPushPayload(notification: Notifications.Notification): TrustedPushPayload | null {
  return normalizeTrustedPushPayload(notification.request.content.data);
}

function extractPushTitle(notification: Notifications.Notification): string {
  return notification.request.content.title?.trim() || MOBILE_COPY.feedback.pushForegroundReceived;
}

function extractPushBody(notification: Notifications.Notification): string {
  return notification.request.content.body?.trim() || '';
}

function pushRouteTarget(
  router: ReturnType<typeof useRouter>,
  target: ReturnType<typeof resolvePushRouteTarget>['target'],
): void {
  switch (target.pathname) {
    case '/artists/[slug]':
      router.push({
        pathname: '/artists/[slug]',
        params: {
          slug: target.params?.slug ?? '',
        },
      });
      return;
    case '/releases/[id]':
      router.push({
        pathname: '/releases/[id]',
        params: {
          id: target.params?.id ?? '',
        },
      });
      return;
    case '/(tabs)/search':
      router.push({
        pathname: '/(tabs)/search',
        params: target.params,
      });
      return;
    case '/(tabs)/radar':
      router.push({
        pathname: '/(tabs)/radar',
        params: target.params,
      });
      return;
    case '/(tabs)/calendar':
    default:
      router.push({
        pathname: '/(tabs)/calendar',
        params: target.params,
      });
  }
}

export function PushNotificationRuntimeBoundary({ children }: Props) {
  const router = useRouter();
  const runtimeConfig = getRuntimeConfig();
  const theme = useAppTheme();
  const insets = useOptionalSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [foregroundNotice, setForegroundNotice] = useState<ForegroundPushNotice | null>(null);
  const handledNotificationIdsRef = useRef<Set<string>>(new Set());

  const handlePushOpen = useCallback(
    async (payload: TrustedPushPayload | null, source: PushRouteHandlingMode) => {
      const resolved = resolvePushRouteTarget(payload);
      trackAnalyticsEvent('push_notification_opened', {
        destinationKind: resolved.destinationKind,
        eventType: payload?.event_type ?? 'trusted_upcoming_signal',
        source,
      });
      pushRouteTarget(router, resolved.target);
    },
    [router],
  );

  const handleForegroundDismiss = useCallback(() => {
    if (!foregroundNotice) {
      return;
    }

    const resolved = resolvePushRouteTarget(foregroundNotice.payload);
    trackAnalyticsEvent('push_notification_dismissed', {
      destinationKind: resolved.destinationKind,
      eventType: foregroundNotice.eventType,
      source: 'foreground_dismiss',
    });
    setForegroundNotice(null);
  }, [foregroundNotice]);

  useEffect(() => {
    if (!runtimeConfig.services.apiBaseUrl) {
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    void ensureAndroidNotificationChannel().catch(() => {
      // Android channel setup failure should not crash app bootstrap.
    });

    void syncPushRegistration({
      reason: 'launch',
      runtimeConfig,
    }).catch((error) => {
      trackAnalyticsEvent('push_registration_failed', {
        reason: 'launch',
        code: error instanceof Error ? error.name : 'push_registration_failed',
        retryable: true,
      });
      trackFailureObserved(
        'calendar',
        'degraded',
        error instanceof Error ? error.name : 'push_registration_failed',
        true,
      );
    });

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const payload = extractPushPayload(notification);
      const resolved = resolvePushRouteTarget(payload);
      trackAnalyticsEvent('push_notification_received', {
        destinationKind: resolved.destinationKind,
        eventType: payload?.event_type ?? 'trusted_upcoming_signal',
      });
      setForegroundNotice({
        id: getNotificationIdentifier(notification),
        title: extractPushTitle(notification),
        body: extractPushBody(notification),
        payload,
        eventType: payload?.event_type ?? 'trusted_upcoming_signal',
      });
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const notification = response.notification;
      const identifier = getNotificationIdentifier(notification);
      if (handledNotificationIdsRef.current.has(identifier)) {
        return;
      }

      handledNotificationIdsRef.current.add(identifier);
      setForegroundNotice(null);
      void handlePushOpen(extractPushPayload(notification), 'background_resume');
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) {
        return;
      }

      const identifier = getNotificationIdentifier(response.notification);
      if (handledNotificationIdsRef.current.has(identifier)) {
        return;
      }

      handledNotificationIdsRef.current.add(identifier);
      void handlePushOpen(extractPushPayload(response.notification), 'cold_start');
      void Notifications.clearLastNotificationResponseAsync();
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
      Notifications.setNotificationHandler(null);
    };
  }, [handlePushOpen, runtimeConfig]);

  return (
    <>
      {children}
      {foregroundNotice ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            {
              paddingTop: insets.top + theme.space[12],
              paddingHorizontal: theme.space[16],
            },
          ]}
        >
          <TonalPanel
            body={foregroundNotice.body || MOBILE_COPY.feedback.pushForegroundReceived}
            footer={
              <View style={styles.noticeActions}>
                <ActionButton
                  accessibilityLabel={MOBILE_COPY.push.foregroundDismiss}
                  label={MOBILE_COPY.push.foregroundDismiss}
                  onPress={handleForegroundDismiss}
                  tone="secondary"
                />
                <ActionButton
                  accessibilityLabel={MOBILE_COPY.push.foregroundOpen}
                  label={MOBILE_COPY.push.foregroundOpen}
                  onPress={() => {
                    const payload = foregroundNotice.payload;
                    setForegroundNotice(null);
                    void handlePushOpen(payload, 'foreground_open');
                  }}
                  tone="primary"
                />
              </View>
            }
            title={foregroundNotice.title}
            tone="accent"
          />
        </View>
      ) : null}
    </>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    noticeActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.space[8],
    },
  });
}
