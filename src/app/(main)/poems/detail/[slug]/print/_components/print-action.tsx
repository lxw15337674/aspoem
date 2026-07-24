"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintAction() {
  return (
    <Button className="print:hidden" onClick={() => window.print()}>
      <PrinterIcon />
      打印
    </Button>
  );
}
