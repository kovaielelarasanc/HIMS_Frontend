// src/routes/ProviderRoute.jsx
import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";
import { PROVIDER_TENANT_CODE } from "../config/provider";

function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;

    // ✅ Base64URL -> Base64
    const b64url = parts[1];
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    return JSON.parse(atob(b64 + pad));
  } catch {
    return null;
  }
}

/**
 * ProviderRoute
 * - No env required
 * - Provider identified by JWT `tcode` OR localStorage `tenant_code`
 * - Permission check if reqAny passed
 */
export default function ProviderRoute({ reqAny = [], providerCode }) {
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const modules = useAuth((s) => s.modules) || {};

  const provider = String(providerCode || PROVIDER_TENANT_CODE || "NUTRYAH")
    .trim()
    .toUpperCase();

  const { okProvider, tokenTcode, tenantCode } = useMemo(() => {
    const token = localStorage.getItem("access_token");
    const payload = decodeJwtPayload(token);

    const tokenTcode = String(payload?.tcode || "").trim().toUpperCase();
    const tenantCode = String(localStorage.getItem("tenant_code") || "").trim().toUpperCase();

    const okByToken = tokenTcode && tokenTcode === provider;
    const okByStorage = tenantCode && tenantCode === provider;

    return { okProvider: okByToken || okByStorage, tokenTcode, tenantCode };
  }, [provider]);

  if (!okProvider) {
    // console.log("[ProviderRoute] blocked", { tokenTcode, tenantCode, provider })
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  // ✅ Permission check
  const admin = !!user?.is_admin;

  const grantedSet = useMemo(() => {
    const fromModules = Object.values(modules)
      .flat()
      .map((p) => (typeof p === "string" ? p : p?.code))
      .filter(Boolean);

    const fromUser = (user?.permissions || [])
      .map((p) => (typeof p === "string" ? p : p?.code))
      .filter(Boolean);

    return new Set([...(fromModules || []), ...(fromUser || [])]);
  }, [modules, user]);

  const hasAny = (codes = []) => (admin ? true : (codes || []).some((c) => grantedSet.has(c)));

  if (reqAny?.length && !hasAny(reqAny)) {
    return <Navigate to="/dashboard" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
