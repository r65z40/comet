"use client";

import TicketToast from "./TicketToast";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TicketToast />
    </>
  );
}
