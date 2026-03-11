import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/actions/ActionButton';
import { InlineFeedbackNotice, ScreenFeedbackState } from '../../src/components/feedback/FeedbackState';
import { AppBar } from '../../src/components/layout/AppBar';
import { InsetSection } from '../../src/components/surfaces/InsetSection';
import { TonalPanel } from '../../src/components/surfaces/TonalPanel';
import { MOBILE_COPY } from '../../src/copy/mobileCopy';
import {
  trackAnalyticsEvent,
  trackFailureObserved,
} from '../../src/services/analytics';
import type { BackendWriteError } from '../../src/services/backendWriteClient';
import {
  getPushPermissionSnapshot,
  getPushSettingsSummary,
  readStoredPushRegistrationState,
  resolveExpoProjectId,
  syncPushRegistration,
  updatePushAlertsEnabled,
  type PushPermissionStatus,
  type StoredPushRegistrationState,
} from '../../src/services/pushNotifications';
import { useOptionalSafeAreaInsets } from '../../src/hooks/useOptionalSafeAreaInsets';
import { useAppTheme } from '../../src/tokens/theme';

function resolveStatusTitle(permissionStatus: PushPermissionStatus, isActive: boolean): string {
  if (isActive) {
    return MOBILE_COPY.push.statusReady;
  }

  if (permissionStatus === 'denied') {
    return MOBILE_COPY.push.statusDenied;
  }

  if (permissionStatus === 'not_determined') {
    return MOBILE_COPY.push.statusNeedsPermission;
  }

  return MOBILE_COPY.push.statusUnavailable;
}

function resolveStatusBody(state: StoredPushRegistrationState | null): string {
  if (!state) {
    return MOBILE_COPY.feedback.pushRegistrationUnavailable;
  }

  if (state.isActive) {
    if (state.permissionStatus === 'provisional') {
      return MOBILE_COPY.push.provisionalBody;
    }

    return MOBILE_COPY.feedback.pushForegroundReceived;
  }

  if (state.permissionStatus === 'denied') {
    return MOBILE_COPY.feedback.pushPermissionDenied;
  }

  if (state.permissionStatus === 'not_determined') {
    return MOBILE_COPY.feedback.pushPermissionRequired;
  }

  return MOBILE_COPY.feedback.pushRegistrationUnavailable;
}

function isRetryableWriteError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const backendError = error as BackendWriteError & { code?: string | null };
  return backendError.code === 'network_unavailable' || backendError.code === 'timeout';
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useOptionalSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pushState, setPushState] = useState<StoredPushRegistrationState | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('not_determined');
  const [isBusy, setIsBusy] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const [storedState, permissionSnapshot] = await Promise.all([
      readStoredPushRegistrationState(),
      getPushPermissionSnapshot(),
    ]);

    setPushState(storedState);
    setPermissionStatus(permissionSnapshot.permissionStatus);
  }, []);

  useEffect(() => {
    trackAnalyticsEvent('push_permission_prompt_viewed', {
      surface: 'notifications_settings',
    });
    void refreshState();
  }, [refreshState]);

  const summary = getPushSettingsSummary(pushState);
  const projectId = resolveExpoProjectId();

  const runAction = useCallback(
    async (action: () => Promise<StoredPushRegistrationState>) => {
      setIsBusy(true);
      setErrorMessage(null);
      setFeedbackMessage(null);

      try {
        const nextState = await action();
        setPushState(nextState);
        setPermissionStatus(nextState.permissionStatus);
        setFeedbackMessage(MOBILE_COPY.push.syncSuccess);
      } catch (error) {
        const message = error instanceof Error ? error.message : MOBILE_COPY.push.syncFailed;
        setErrorMessage(message);
        trackFailureObserved(
          'notifications_settings',
          'blocking',
          error instanceof Error ? error.name : 'push_registration_failed',
          isRetryableWriteError(error),
        );
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const handleRequestPermission = useCallback(async () => {
    await runAction(async () => {
      const nextState = await syncPushRegistration({
        reason: 'permission_prompt',
        requestPermission: true,
      });
      trackAnalyticsEvent('push_permission_requested', {
        result: nextState.permissionStatus,
        canAskAgain: nextState.permissionStatus !== 'denied',
      });
      return nextState;
    });
  }, [runAction]);

  const handleRefreshRegistration = useCallback(async () => {
    await runAction(() =>
      syncPushRegistration({
        reason: 'settings',
      }),
    );
  }, [runAction]);

  const handleToggleAlerts = useCallback(async () => {
    await runAction(() =>
      updatePushAlertsEnabled({
        alertsEnabled: !summary.alertsEnabled,
      }),
    );
  }, [runAction, summary.alertsEnabled]);

  const handleOpenSettings = useCallback(async () => {
    await Linking.openSettings();
  }, []);

  if (pushState === null && isBusy) {
    return (
      <ScreenFeedbackState
        body="알림 상태를 확인하는 중입니다."
        eyebrow="알림"
        title={MOBILE_COPY.surface.notificationsTitle}
        variant="loading"
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: theme.space[16] + insets.top,
          paddingBottom: theme.space[32] + insets.bottom,
        },
      ]}
      style={styles.screen}
    >
      <AppBar
        leadingAction={{
          accessibilityLabel: MOBILE_COPY.action.back,
          label: MOBILE_COPY.action.back,
          onPress: () => router.back(),
        }}
        testID="notifications-settings-app-bar"
        title={MOBILE_COPY.surface.notificationsTitle}
      />

      <TonalPanel
        body={resolveStatusBody(pushState)}
        title={resolveStatusTitle(permissionStatus, summary.isActive)}
        tone={summary.isActive ? 'default' : 'accent'}
      />

      {projectId ? null : (
        <InlineFeedbackNotice body="Expo project id가 없어 이 빌드에서는 푸시 토큰을 만들 수 없습니다." />
      )}

      {feedbackMessage ? <InlineFeedbackNotice body={feedbackMessage} /> : null}
      {errorMessage ? <InlineFeedbackNotice body={errorMessage} tone="error" /> : null}

      <InsetSection
        description={
          summary.alertsEnabled ? MOBILE_COPY.push.trustedAlertsOn : MOBILE_COPY.push.trustedAlertsOff
        }
        title="받을 알림"
      >
        <ActionButton
          accessibilityLabel={summary.alertsEnabled ? MOBILE_COPY.action.disableNotifications : MOBILE_COPY.action.enableNotifications}
          label={summary.alertsEnabled ? MOBILE_COPY.action.disableNotifications : MOBILE_COPY.action.enableNotifications}
          onPress={() => void handleToggleAlerts()}
          tone={summary.alertsEnabled ? 'secondary' : 'primary'}
        />
      </InsetSection>

      <InsetSection
        description={
          permissionStatus === 'provisional'
            ? MOBILE_COPY.push.provisionalBody
            : MOBILE_COPY.push.prePromptBody
        }
        title={MOBILE_COPY.push.prePromptTitle}
      >
        {permissionStatus === 'not_determined' ? (
          <ActionButton
            accessibilityLabel={MOBILE_COPY.action.requestPermission}
            label={MOBILE_COPY.action.requestPermission}
            onPress={() => void handleRequestPermission()}
            tone="primary"
          />
        ) : null}
        {permissionStatus === 'denied' ? (
          <ActionButton
            accessibilityLabel={MOBILE_COPY.action.openSettings}
            label={MOBILE_COPY.action.openSettings}
            onPress={() => void handleOpenSettings()}
            tone="secondary"
          />
        ) : null}
      </InsetSection>

      <InsetSection
        description={`권한 · ${permissionStatus} / 활성 · ${summary.isActive ? 'on' : 'off'}`}
        title="등록 상태"
      >
        <View style={styles.metaList}>
          <Text style={styles.metaText}>installation id · {pushState?.installationId ?? '미생성'}</Text>
          <Text style={styles.metaText}>request id · {pushState?.lastRequestId ?? '없음'}</Text>
          <Text style={styles.metaText}>project id · {pushState?.projectId ?? '없음'}</Text>
        </View>
        <ActionButton
          accessibilityLabel={MOBILE_COPY.action.refreshRegistration}
          label={MOBILE_COPY.action.refreshRegistration}
          onPress={() => void handleRefreshRegistration()}
          tone="secondary"
        />
      </InsetSection>
    </ScrollView>
  );
}

function createStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.surface.base,
    },
    content: {
      gap: theme.space[16],
      paddingHorizontal: theme.space[16],
    },
    metaList: {
      gap: theme.space[8],
    },
    metaText: {
      ...theme.typography.meta,
      color: theme.colors.text.secondary,
    },
  });
}
