/**
 * Mask email for leaderboard display
 * Format: first 3 chars - *** - last 3 chars, pad with * if not enough
 * 
 * Examples:
 *   john@gmail.com   → joh-***-ohn
 *   ab@gmail.com     → ab*-***-*ab
 *   a@gmail.com      → a**-***-**a
 */
export function maskEmail(email: string): string {
  const prefix = email.split('@')[0]
  const len = prefix.length

  const first = (prefix.slice(0, 3)).padEnd(3, '*')
  const last = (prefix.slice(-3)).padStart(3, '*')

  // Handle case where prefix is <= 3 chars (first and last overlap)
  if (len <= 3) {
    const padded = prefix.padEnd(3, '*')
    const paddedLast = prefix.padStart(3, '*')
    return `${padded}-***-${paddedLast}`
  }

  return `${first}-***-${last}`
}
