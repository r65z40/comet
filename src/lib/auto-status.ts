/**
 * Auto-correction of installation statuses is disabled.
 * All status changes (EN_PARC, HORS_PARC, RENOUVELE) must be done manually.
 * When a warranty end date passes, the installation stays in its current status.
 */
export async function autoCorrectInstallationStatuses(): Promise<number> {
  return 0;
}
