// frontend/src/utils/permLabels.js
import { useCallback, useMemo } from "react"
import { useAuth } from "../store/authStore"

const ACTION_LABELS = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
  manage: "Manage",
  approve: "Approve",
  cancel: "Cancel",
  close: "Close",
  reopen: "Reopen",
  submit: "Submit",
  post: "Post",
  print: "Print",
  export: "Export",
  sign: "Sign",
  dispense: "Dispense",
  issue: "Issue",
  add: "Add",
}

const MODULE_LABELS = {
  ipd: "IPD",
  opd: "OPD",
  emr: "EMR",
  lis: "LIS",
  ris: "RIS",
  ot: "OT",
  mis: "MIS",
  ui: "UI",
  quickorder: "Quick Order",
  pharmacy: "Pharmacy",
  inventory: "Inventory",
  billing: "Billing",
  patients: "Patients",
  lab: "Lab",
  radiology: "Radiology",
  schedules: "Schedules",
  appointments: "Appointments",
  roles: "Roles",
  permissions: "Permissions",
  users: "Users",
  departments: "Departments",
  settings: "Settings",
}

function titleCase(str) {
  return String(str || "")
    .split(/[_\\-\\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function humanizeSegment(seg) {
  if (!seg) return ""
  if (MODULE_LABELS[seg]) return MODULE_LABELS[seg]
  if (ACTION_LABELS[seg]) return ACTION_LABELS[seg]
  return titleCase(seg)
}

export function labelFromCode(code) {
  if (!code) return ""
  const parts = String(code).split(".").filter(Boolean)
  if (!parts.length) return String(code)

  const action = parts[parts.length - 1]
  const hasAction = !!ACTION_LABELS[action]

  const moduleParts = hasAction ? parts.slice(0, -1) : parts
  const moduleLabel = moduleParts.map(humanizeSegment).join(" ")

  if (hasAction) return `${moduleLabel} - ${humanizeSegment(action)}`
  return moduleLabel
}

export function usePermLabel() {
  const modules = useAuth((s) => s.modules) || {}

  const labelMap = useMemo(() => {
    const map = new Map()
    Object.values(modules)
      .flat()
      .forEach((p) => {
        if (p?.code && p?.label) map.set(p.code, p.label)
      })
    return map
  }, [modules])

  return useCallback(
    (code, fallback = "") => {
      if (!code) return fallback
      const label = labelMap.get(code)
      return label || labelFromCode(code)
    },
    [labelMap]
  )
}
