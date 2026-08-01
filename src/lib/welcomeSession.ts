let welcomeClaimed = false;

export function shouldShowWelcomeForVersion(dismissedVersion: string, currentVersion: string) {
  return dismissedVersion !== currentVersion;
}

export function claimWelcomeForSession() {
  if (welcomeClaimed) return false;
  welcomeClaimed = true;
  return true;
}
