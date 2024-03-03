export function calculateCandlesNeeded(baseIntervalDurationMs: number, targetIntervalDurationMs: number): number {
  return targetIntervalDurationMs / baseIntervalDurationMs
}
