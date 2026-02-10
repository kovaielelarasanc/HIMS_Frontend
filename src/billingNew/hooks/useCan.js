// FILE: src/billingNew/hooks/useCan.js
import { useCanFn } from "../../hooks/useCan"

/**
 * Backward-compatible wrapper:
 * const can = useCan()
 * can("billing.invoice.print")
 */
export function useCan() {
  const { can } = useCanFn()
  return can
}
