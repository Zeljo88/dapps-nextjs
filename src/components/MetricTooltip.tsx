"use client";

import { useState, type ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";

export default function MetricTooltip({ text, label, children, className = "" }: {
  text: string; label?: string; children?: ReactNode; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return <Tooltip.Provider delayDuration={150}><Tooltip.Root open={open} onOpenChange={setOpen}>
    <Tooltip.Trigger asChild><button type="button" className={`metric-tooltip-trigger ${className}`} aria-label={label}
      onClick={event => { event.preventDefault(); setOpen(true); }}>{children ?? <Info size={14} aria-hidden="true" />}</button></Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content sideOffset={8} collisionPadding={12} className="metric-tooltip-content">
      {text}<Tooltip.Arrow className="metric-tooltip-arrow" />
    </Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root></Tooltip.Provider>;
}
