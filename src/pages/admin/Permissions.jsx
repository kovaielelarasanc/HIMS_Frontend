// FILE: frontend/src/admin/Permissions.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react"
import API from "../../api/client"
import { useModulePerms } from "../../utils/perm"
import { toast } from "sonner"
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  ShieldCheck,
  X,
  ChevronsUpDown,
  Check,
} from "lucide-react"

// shadcn/ui (adjust paths if your project differs)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

function normalize(s = "") {
  return String(s || "").trim()
}

function ModuleDropdown({
  value,
  onChange,
  options,
  disabled,
}) {
  const [open, setOpen] = useState(false)

  const selectedLabel =
    value === "ALL" ? "All Modules" : (value || "Select module")

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-between rounded-2xl"
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[320px] p-0 rounded-2xl" align="start">
        <Command>
          <CommandInput placeholder="Search module..." />
          <CommandList>
            <CommandEmpty>No module found.</CommandEmpty>

            <CommandGroup heading="Modules">
              <CommandItem
                value="ALL"
                onSelect={() => {
                  onChange("ALL")
                  setOpen(false)
                }}
                className="rounded-xl"
              >
                <Check className={`mr-2 h-4 w-4 ${value === "ALL" ? "opacity-100" : "opacity-0"}`} />
                All Modules
              </CommandItem>

              {options.map((m) => (
                <CommandItem
                  key={m.module}
                  value={m.module}
                  onSelect={() => {
                    onChange(m.module)
                    setOpen(false)
                  }}
                  className="rounded-xl"
                >
                  <Check className={`mr-2 h-4 w-4 ${value === m.module ? "opacity-100" : "opacity-0"}`} />
                  <span className="truncate">{m.module}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {m.count}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function Permissions() {
  const { hasAny, canView, canCreate, canUpdate, canDelete } =
    useModulePerms("permissions")

  const [items, setItems] = useState([])
  const [modules, setModules] = useState([]) // [{module, count}]
  const [pageBusy, setPageBusy] = useState(false)
  const [error, setError] = useState("")

  // Draft search (won’t auto reload each keystroke)
  const [qDraft, setQDraft] = useState("")
  const [qApplied, setQApplied] = useState("")

  // Module is applied immediately when selected
  const [moduleApplied, setModuleApplied] = useState("ALL")

  // modal + form
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ code: "", label: "", module: "" })
  const [saving, setSaving] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)

  const moduleCountMap = useMemo(() => {
    const map = new Map()
    for (const m of modules) map.set(m.module, m.count)
    return map
  }, [modules])

  const globalTotal = useMemo(() => {
    return modules.reduce((acc, m) => acc + (m.count || 0), 0)
  }, [modules])

  const selectedModuleCount =
    moduleApplied === "ALL"
      ? globalTotal
      : (moduleCountMap.get(moduleApplied) || 0)

  const loadModules = useCallback(async () => {
    if (!canView) return
    try {
      const r = await API.get("/permissions/modules")
      setModules(Array.isArray(r.data) ? r.data : [])
    } catch {
      // not fatal; UI can still work without module counts
      setModules([])
    }
  }, [canView])

  const load = useCallback(async () => {
    if (!canView) return
    setError("")
    setPageBusy(true)
    try {
      const r = await API.get("/permissions/", {
        params: {
          q: normalize(qApplied) || undefined,
          module: moduleApplied !== "ALL" ? moduleApplied : undefined,
        },
      })
      setItems(Array.isArray(r.data) ? r.data : [])
    } catch (e) {
      const s = e?.response?.status
      if (s === 403) setError("Access denied for Permissions.")
      else if (s === 401) setError("Session expired. Please login again.")
      else setError(e?.response?.data?.detail || "Failed to load")
    } finally {
      setPageBusy(false)
    }
  }, [canView, qApplied, moduleApplied])

  useEffect(() => {
    if (!canView) return
    loadModules()
    load()
  }, [canView, loadModules, load])

  const applySearch = () => {
    setQApplied(qDraft)
  }

  // whenever applied search changes, reload
  useEffect(() => {
    if (!canView) return
    load()
  }, [qApplied, moduleApplied]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setEditId(null)
    setForm({ code: "", label: "", module: "" })
  }

  const openCreate = () => {
    if (!canCreate) return
    resetForm()
    setOpen(true)
  }

  const openEdit = (p) => {
    if (!canUpdate) return
    setEditId(p.id)
    setForm({
      code: p.code || "",
      label: p.label || "",
      module: p.module || "",
    })
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setSaving(false)
    setError("")
    resetForm()
  }

  const save = async (e) => {
    e?.preventDefault?.()

    if (!editId && !canCreate) return
    if (editId && !canUpdate) return

    const payload = {
      code: normalize(form.code),
      label: normalize(form.label),
      module: normalize(form.module),
    }

    if (!payload.code || !payload.label || !payload.module) {
      toast.error("Please fill all fields.")
      return
    }

    setSaving(true)
    setError("")
    try {
      if (editId) {
        await API.put(`/permissions/${editId}`, payload)
        toast.success("Permission updated")
      } else {
        await API.post("/permissions/", payload)
        toast.success("Permission created")
      }
      closeModal()
      await loadModules()
      await load()
    } catch (e2) {
      const msg = e2?.response?.data?.detail || "Failed to save"
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p) => {
    if (!canDelete) return
    const ok = window.confirm(`Delete permission "${p.code}"?`)
    if (!ok) return

    setLoadingDelete(true)
    setError("")
    try {
      await API.delete(`/permissions/${p.id}`)
      toast.success("Permission deleted")
      await loadModules()
      await load()
    } catch (e) {
      const msg = e?.response?.data?.detail || "Failed to delete"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoadingDelete(false)
    }
  }

  const clearFilters = () => {
    setQDraft("")
    setQApplied("")
    setModuleApplied("ALL")
  }

  if (!hasAny || !canView) {
    return (
      <section className="p-4">
        <Card className="rounded-2xl border border-amber-200 bg-amber-50/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Permissions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-700">
            You don’t have access to view this module.
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="p-4 text-black">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border bg-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">Permissions</h1>
              <Badge variant="secondary" className="rounded-full">
                Showing: {items.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Filter by module using searchable dropdown.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => {
              loadModules()
              load()
            }}
            disabled={pageBusy}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          {canCreate && (
            <Button className="rounded-2xl" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Permission
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4 rounded-2xl border bg-white/70 shadow-sm backdrop-blur">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            {/* Search */}
            <div className="md:col-span-5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border bg-white px-3 shadow-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="h-10 w-full bg-transparent text-sm outline-none"
                  placeholder="Search by code / label / module…"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch()
                  }}
                />
                {qDraft ? (
                  <button
                    className="rounded-xl p-1 hover:bg-muted"
                    onClick={() => setQDraft("")}
                    type="button"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="mt-2 flex gap-2">
                <Button className="rounded-2xl" onClick={applySearch} disabled={pageBusy}>
                  Apply Search
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={clearFilters}
                  disabled={!qDraft && !qApplied && moduleApplied === "ALL"}
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Module Dropdown */}
            <div className="md:col-span-7">
              <Label className="text-xs text-muted-foreground">
                Module (searchable dropdown)
              </Label>

              <div className="mt-1 grid gap-2 md:grid-cols-2">
                <ModuleDropdown
                  value={moduleApplied}
                  onChange={(val) => setModuleApplied(val)}
                  options={modules}
                  disabled={pageBusy}
                />

                <Card className="rounded-2xl border bg-white shadow-sm">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Selected module count</div>
                    <div className="mt-1 flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {moduleApplied === "ALL" ? "All Modules" : moduleApplied}
                      </div>
                      <Badge className="rounded-full" variant="secondary">
                        {selectedModuleCount}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {moduleApplied === "ALL"
                        ? "Showing permissions across all modules."
                        : "Showing permissions only for selected module."}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {qApplied ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  Active search: <span className="font-medium text-black">"{qApplied}"</span>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* List */}
      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {moduleApplied === "ALL" ? "Permissions" : `Permissions — ${moduleApplied}`}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="p-3">#</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Label</th>
                    <th className="p-3">Module</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((p, i) => (
                    <tr key={p.id} className="border-b hover:bg-muted/40">
                      <td className="p-3 text-sm">{i + 1}</td>
                      <td className="p-3">
                        <div className="font-mono text-xs">{p.code}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">{p.label}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="rounded-full">
                          {p.module}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          {canUpdate && (
                            <Button
                              variant="outline"
                              className="rounded-2xl"
                              onClick={() => openEdit(p)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              variant="destructive"
                              className="rounded-2xl"
                              onClick={() => remove(p)}
                              disabled={loadingDelete}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!items.length && (
                    <tr>
                      <td className="p-6 text-sm text-muted-foreground" colSpan={5}>
                        {pageBusy ? "Loading..." : "No permissions found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden">
            <div className="p-4 space-y-3">
              {items.map((p) => (
                <div key={p.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{p.code}</div>
                      <div className="mt-1 text-sm font-medium">{p.label}</div>
                      <div className="mt-2">
                        <Badge variant="secondary" className="rounded-full">
                          {p.module}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      {canUpdate && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="destructive"
                          className="rounded-2xl"
                          onClick={() => remove(p)}
                          disabled={loadingDelete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {!items.length && (
                <div className="rounded-2xl border bg-white p-4 text-sm text-muted-foreground shadow-sm">
                  {pageBusy ? "Loading..." : "No permissions found."}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Center Modal */}
      <Dialog open={open} onOpenChange={(v) => (!v ? closeModal() : setOpen(v))}>
        <DialogContent className="max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editId ? "Edit Permission" : "Create Permission"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-2">
              <Label>Code</Label>
              <Input
                className="rounded-2xl"
                placeholder="e.g. users.view"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={editId ? !canUpdate : !canCreate}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Label</Label>
              <Input
                className="rounded-2xl"
                placeholder="Users — View"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                disabled={editId ? !canUpdate : !canCreate}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Module</Label>
              <Input
                className="rounded-2xl"
                placeholder="users"
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                disabled={editId ? !canUpdate : !canCreate}
                required
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={closeModal}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                className="rounded-2xl"
                disabled={saving || (editId ? !canUpdate : !canCreate)}
              >
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
