// sendFeedback — open an in-app mail composer pre-addressed to Lucas, with a
// version/OS line appended so each report carries context. Falls back to a mailto:
// link, then to just showing the address, if no mail composer/account is available.
import { Alert, Linking, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import Constants from 'expo-constants';

const FEEDBACK_EMAIL = 'lucas.venugopal.dev@gmail.com';
const SUBJECT = 'Pilot feedback';

// A trailing signature so feedback arrives with the app version + OS — the user
// types above it. Three newlines give them room to write first.
function contextLine(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '?';
  return `\n\n\n— Pilot ${version} · ${Platform.OS} ${Platform.Version}`;
}

export async function sendFeedback(): Promise<void> {
  try {
    if (await MailComposer.isAvailableAsync()) {
      await MailComposer.composeAsync({
        recipients: [FEEDBACK_EMAIL],
        subject: SUBJECT,
        body: contextLine(),
      });
      return;
    }
  } catch {
    // Composer threw (no account, user-cancel surfaces as resolve, not throw) —
    // fall through to mailto.
  }

  // Fallback 1: hand off to the system mailto handler.
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(SUBJECT)}`;
  try {
    if (await Linking.canOpenURL(mailto)) {
      await Linking.openURL(mailto);
      return;
    }
  } catch {
    // ignore — fall through to the address alert.
  }

  // Fallback 2: at least show the address so they can reach me.
  Alert.alert('Send feedback', `Email me at ${FEEDBACK_EMAIL}`);
}
