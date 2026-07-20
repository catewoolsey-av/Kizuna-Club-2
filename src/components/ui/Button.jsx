import React from "react";
import { colors } from "../../constants/theme";

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
}) => {
  const base =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
  };
  const variants = {
    primary: "text-white hover:opacity-90",
    accent: "text-white hover:opacity-90",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  const style =
    variant === "primary"
      ? { backgroundColor: colors.primary }
      : variant === "accent"
      ? { backgroundColor: colors.accent }
      : {};

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={style}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
};
