import React from "react";
import { colors } from "../../constants/theme";

export const Badge = ({ children, variant = "default", className = "" }) => {
  const styles = {
    default: "bg-gray-100 text-gray-700",
    accent: "text-white",
    success: "bg-emerald-100 text-emerald-700",
    primary: "text-white",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
  };

  const customStyle =
    variant === "accent"
      ? { backgroundColor: colors.accent }
      : variant === "primary"
      ? { backgroundColor: colors.primary }
      : {};

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[variant]} ${className}`}
      style={customStyle}
    >
      {children}
    </span>
  );
};
