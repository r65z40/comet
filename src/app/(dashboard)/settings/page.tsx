"use client";

import { useEffect, useState } from "react";
import { Settings2, Plug, Mail, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import GeneralTab from "./GeneralTab";
import IntegrationsTab from "./IntegrationsTab";
import EmailTab from "./EmailTab";
import ReportsTab from "./ReportsTab";
import AdminTab from "./AdminTab";

const SETTINGS_TABS = [
  { id: "general", label: "Général", icon: Settings2 },
  { id: "integrations", label: "Intégrations", icon: Plug },
  { id: "email", label: "Email & Alertes", icon: Mail },
  { id: "reports", label: "Rapports", icon: FileText },
  { id: "admin", label: "Administration", icon: Users },
];

export default function SettingsPage() {
  const [userRole, setUserRole] = useState<string>("");
  const isAdmin = userRole === "ADMIN";
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("general");

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tools: true,
  });
  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => { if (data?.user?.role) setUserRole(data.user.role); })
      .catch(() => {});
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const tabProps = { settings, isAdmin, openSections, toggleSection };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500 mt-1">Configuration de l&apos;application</p>
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden flex gap-1 overflow-x-auto pb-2 -mx-4 px-4">
        {SETTINGS_TABS.filter(tab => tab.id !== "admin" || isAdmin).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors shrink-0",
              activeTab === tab.id
                ? "bg-primary-50 text-primary-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary-600" : "text-slate-400")} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Sidebar navigation */}
        <nav className="w-56 shrink-0 hidden lg:block">
          <div className="sticky top-6 space-y-1">
            {SETTINGS_TABS.filter(tab => tab.id !== "admin" || isAdmin).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                  activeTab === tab.id
                    ? "bg-primary-50 text-primary-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <tab.icon className={cn("h-4 w-4", activeTab === tab.id ? "text-primary-600" : "text-slate-400")} />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === "general" && <GeneralTab {...tabProps} />}
          {activeTab === "integrations" && <IntegrationsTab {...tabProps} />}
          {activeTab === "email" && <EmailTab {...tabProps} />}
          {activeTab === "reports" && <ReportsTab {...tabProps} />}
          {activeTab === "admin" && isAdmin && <AdminTab {...tabProps} />}
        </div>
      </div>
    </div>
  );
}
