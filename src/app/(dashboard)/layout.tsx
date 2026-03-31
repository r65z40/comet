import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import BroadcastBanner from "@/components/layout/BroadcastBanner";
import ClientProviders from "@/components/layout/ClientProviders";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <ClientProviders>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 lg:ml-64">
          <Header />
          <BroadcastBanner />
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ClientProviders>
  );
}
