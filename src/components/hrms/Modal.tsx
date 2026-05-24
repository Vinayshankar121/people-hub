import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`bg-white w-full sm:rounded-2xl rounded-t-2xl shadow-xl ${maxWidth} max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
