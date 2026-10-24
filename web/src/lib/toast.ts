import { toast as emit } from "react-toastify";
import { FlowbiteToast, type ToastTone } from "@/components/ui/flowbite-toast";

// Toast = resultado transitório (5s, pausa no hover). Erro de formulário ou da página = Alert.

function show(tone: ToastTone, message: string) {
  emit((props) => FlowbiteToast({ ...props, data: { message, tone } }), {
    type: tone === "error" ? "error" : tone,
    role: tone === "error" ? "alert" : "status",
  });
}

export const toast = {
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
  warning: (message: string) => show("warning", message),
  info: (message: string) => show("info", message),
};
