let welcomeClaimed = false;

export function claimWelcomeForSession() {
  if (welcomeClaimed) return false;
  welcomeClaimed = true;
  return true;
}
