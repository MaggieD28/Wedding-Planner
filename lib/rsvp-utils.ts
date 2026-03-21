export function normalizeDietary(val: string | null | undefined): string | null {
  if (!val) return null
  const lower = val.trim().toLowerCase()
  if (["none", "geen", "nee", "no", "n/a", "na", "-", ""].includes(lower)) return null
  return val.trim()
}
