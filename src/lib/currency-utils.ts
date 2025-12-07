import { CURRENCIES } from './types'

/**
 * Format amount with currency symbol and flag
 * @param amount - The amount to format
 * @param currency - Currency code (e.g., 'USD', 'EUR')
 * @param fallbackText - Text to display when amount is empty
 * @returns Formatted string with currency symbol, or fallback text if amount is empty
 */
export function formatAmount(amount: string, currency: string, fallbackText: string): string {
  const trimmedAmount = amount?.trim() || ''
  if (!trimmedAmount) {
    return fallbackText
  }
  const curr = CURRENCIES.find(c => c.code === currency)
  if (curr) {
    return `${curr.flag} ${curr.symbol}${trimmedAmount} ${curr.code}`
  }
  // Fallback: show amount with unknown currency code
  return currency ? `${trimmedAmount} ${currency}` : trimmedAmount
}
