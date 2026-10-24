import { Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import type { ToastContentProps } from "react-toastify";
import { cn } from "@/lib/utils";

const tones = {
  success: {
    icon: Check,
    iconWrap: "bg-success-subtle text-success",
    label: "Sucesso",
  },
  error: {
    icon: CircleAlert,
    iconWrap: "bg-danger-subtle text-danger",
    label: "Erro",
  },
  warning: {
    icon: TriangleAlert,
    iconWrap: "bg-warning-subtle text-foreground",
    label: "Atenção",
  },
  info: {
    icon: Info,
    iconWrap: "bg-info-subtle text-foreground",
    label: "Informação",
  },
} as const;

export type ToastTone = keyof typeof tones;

export function FlowbiteToast({
  closeToast,
  data,
}: ToastContentProps<{ message: string; tone: ToastTone }>) {
  const tone = tones[data.tone] ?? tones.info;
  const Icon = tone.icon;

  return (
    <div className="flex w-full items-center" role="status">
      <div className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone.iconWrap)}>
        <Icon className="h-4 w-4" aria-hidden />
        <span className="sr-only">{tone.label}</span>
      </div>
      <p className="ms-3 text-sm font-normal text-foreground">{data.message}</p>
      <button
        type="button"
        onClick={closeToast}
        className="ms-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-light hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
