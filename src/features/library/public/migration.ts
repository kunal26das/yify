function dismissNotice(): void {
  return;
}

const NO_MIGRATION_NOTICE = {unresolved: 0, noticeVisible: false, dismissNotice};

export function migrateLocalV1(): void {
  return;
}

export function startLegacyResolution(): void {
  return;
}

export function retryLegacyResolution(): void {
  return;
}

export function useLegacyMigrationStatus(): {unresolved: number; noticeVisible: boolean; dismissNotice(): void} {
  return NO_MIGRATION_NOTICE;
}
