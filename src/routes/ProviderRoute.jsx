// frontend/src/routes/ProviderRoute.jsx
import React, { useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/authStore";

const PROVIDER_TENANT_CODE = "NUTRYAH"; // ✅ set your provider code here

function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length < 2) return null;

    // ✅ base64url -> base64
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
 * - Identifies provider by JWT tcode OR localStorage tenant_code
 * - Optional permission enforcement via reqAny
 */
export default function ProviderRoute({ reqAny = [] }) {
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const modules = useAuth((s) => s.modules) || {};

  const { okProvider } = useMemo(() => {
    const token = localStorage.getItem("access_token");
    const payload = decodeJwtPayload(token);

    const tokenTcode = String(payload?.tcode || "").trim().toUpperCase();
    const tenantCode = String(localStorage.getItem("tenant_code") || "")
      .trim()
      .toUpperCase();

    const provider = String(PROVIDER_TENANT_CODE).trim().toUpperCase();

    const okByToken = tokenTcode && tokenTcode === provider;
    const okByStorage = tenantCode && tenantCode === provider;

    return { okProvider: okByToken || okByStorage };
  }, []);

  if (!okProvider) {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const isAdmin = !!user?.is_admin;

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

  const hasAny = (codes = []) =>
    isAdmin ? true : (codes || []).some((c) => grantedSet.has(c));

  if (reqAny?.length && !hasAny(reqAny)) {
    return (
      <Navigate
        to="/dashboard"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
