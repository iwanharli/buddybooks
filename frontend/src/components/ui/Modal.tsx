import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function Modal({ open, onOpenChange, title, description, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount>
              <motion.div
                className="fixed left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2
                           rounded-lg border border-[var(--color-border)] bg-[var(--color-parchment)]
                           p-6 shadow-xl"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.15 }}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="font-[family-name:var(--font-heading)] text-xl text-[var(--color-ink)]">
                      {title}
                    </Dialog.Title>
                    {description && (
                      <Dialog.Description className="mt-1 text-sm text-[var(--color-ink-soft)]">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close className="rounded-md p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]">
                    <X size={18} />
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
