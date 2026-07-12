import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { motion, AnimatePresence } from "motion/react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <AlertDialog.Portal forceMount>
            <AlertDialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </AlertDialog.Overlay>
            <AlertDialog.Content asChild forceMount>
              <motion.div
                className="fixed left-1/2 top-1/2 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2
                           rounded-lg border border-[var(--color-border)] bg-[var(--color-parchment)]
                           p-6 shadow-xl"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.15 }}
              >
                <AlertDialog.Title className="font-[family-name:var(--font-heading)] text-lg text-[var(--color-ink)]">
                  {title}
                </AlertDialog.Title>
                {description && (
                  <AlertDialog.Description className="mt-2 text-sm text-[var(--color-ink-soft)]">
                    {description}
                  </AlertDialog.Description>
                )}
                <div className="mt-6 flex justify-end gap-3">
                  <AlertDialog.Cancel className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]">
                    {cancelLabel}
                  </AlertDialog.Cancel>
                  <AlertDialog.Action
                    onClick={onConfirm}
                    className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
                      destructive ? "bg-red-700 hover:bg-red-800" : "bg-[var(--color-accent)] hover:opacity-90"
                    }`}
                  >
                    {confirmLabel}
                  </AlertDialog.Action>
                </div>
              </motion.div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        )}
      </AnimatePresence>
    </AlertDialog.Root>
  );
}
