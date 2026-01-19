// FILE: frontend/src/billing/BillingMainDashboard.jsx
import { useEffect, useState } from "react"
import { TrendingUp, Stethoscope, BedDouble } from "lucide-react"

import BillingRevenueDashboard from "@/billing/BillingRevenueDashboard"
import OpdDashboard from "@/opd/Dashboard"
import AdmissionsDashboard from "@/ipd/AdmissionsDashboard"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"

const LS_KEY = "billing_main_dash_tab"

export default function BillingMainDashboard() {
  const [tab, setTab] = useState("revenue")

  useEffect(() => {
    const saved = window.localStorage.getItem(LS_KEY)
    if (saved) setTab(saved)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(LS_KEY, tab)
  }, [tab])

  return (
    <div className="w-full">
      {/* Top Tabs Header (sticky + premium) */}
      <div className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Unified Dashboard
              </div>
              <div className="text-lg md:text-xl font-semibold text-slate-900 truncate">
                Revenue • OP • IP
              </div>
            </div>

            <Card className="rounded-2xl border-slate-200/60 bg-white/70 px-2 py-1 shadow-sm">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="bg-transparent p-0 gap-1">
                  <TabsTrigger value="revenue" className="rounded-xl">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Revenue
                  </TabsTrigger>
                  <TabsTrigger value="op" className="rounded-xl">
                    <Stethoscope className="mr-2 h-4 w-4" />
                    OP
                  </TabsTrigger>
                  <TabsTrigger value="ip" className="rounded-xl">
                    <BedDouble className="mr-2 h-4 w-4" />
                    IP
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="revenue" className="m-0">
          <BillingRevenueDashboard />
        </TabsContent>

        <TabsContent value="op" className="m-0">
          <OpdDashboard />
        </TabsContent>

        <TabsContent value="ip" className="m-0">
          <AdmissionsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
