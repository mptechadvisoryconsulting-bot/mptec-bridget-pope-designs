"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintInvoiceButton() {
  return (
    <Button className="invoice-actions-print" onClick={() => window.print()} type="button" variant="light">
      <Printer size={16} /> Print / Save PDF
    </Button>
  );
}
