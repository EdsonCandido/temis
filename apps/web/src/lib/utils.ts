import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type HealthLevel = "ok" | "warn" | "crit";

export function healthLevel(percent: number): HealthLevel {
  if (percent >= 85) return "crit";
  if (percent >= 70) return "warn";
  return "ok";
}

export function healthColor(level: HealthLevel): string {
  if (level === "crit") return "var(--color-destructive)";
  if (level === "warn") return "var(--color-chart-3)";
  return "var(--color-chart-2)";
}

export function healthLabel(level: HealthLevel): string {
  if (level === "crit") return "crítico";
  if (level === "warn") return "atenção";
  return "ok";
}

export const HEALTH_META = "meta: manter abaixo de 70%";
