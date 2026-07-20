import React, { useEffect } from "react";
import { Check } from "lucide-react";

export const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 ${
        type === "success" ? "bg-emerald-500" : "bg-red-500"
      } text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50`}
    >
      <Check size={18} />
      <span>{message}</span>
    </div>
  );
};
