import React from "react";

export const Card = ({
  children,
  className = "",
  padding = true,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}) => (
  <div
    className={`bg-white rounded-xl border border-gray-200 shadow-sm ${
      padding ? "p-4" : ""
    } ${className}`}
    draggable={draggable}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onDragOver={onDragOver}
    onDrop={onDrop}
  >
    {children}
  </div>
);
