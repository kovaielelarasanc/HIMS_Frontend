// FILE: frontend/src/api/_unwrap.js

/**
 * Your backend returns ok()/err() wrappers like:
 *  ok:  { status: true,  data: ..., msg?: ... }
 *  err: { status: false, msg: "Validation error", error?: { msg, details } }
 *
 * This helper unwraps reliably (also supports raw payloads).
 */

export function unwrapApi(respData) {
  // axios response => resp.data is passed here usually
  const d = respData;

  if (d == null) return null;

  // wrapped format
  if (typeof d === "object" && ("status" in d) && ("data" in d)) {
    if (d.status === false) {
      const msg =
        d?.msg ||
        d?.error?.msg ||
        (Array.isArray(d?.error?.details) ? d.error.details[0]?.msg : null) ||
        "Request failed";
      const e = new Error(msg);
      e.payload = d;
      throw e;
    }
    return d.data;
  }

  // sometimes APIs return {data: ...} without status
  if (typeof d === "object" && ("data" in d) && Object.keys(d).length <= 3) {
    return d.data;
  }

  return d;
}

export function apiErrorMessage(err, fallback = "Something went wrong") {
  // axios error
  const resp = err?.response?.data;
  if (resp) {
    try {
      // If it's wrapped error
      if (resp?.status === false) {
        return (
          resp?.msg ||
          resp?.error?.msg ||
          (Array.isArray(resp?.error?.details) ? resp.error.details[0]?.msg : null) ||
          fallback
        );
      }
    } catch {
      // ignore
    }
  }

  return err?.message || fallback;
}
