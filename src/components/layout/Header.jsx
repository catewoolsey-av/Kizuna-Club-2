import React from "react";
import { Menu } from "lucide-react";

export default function Header({ title, setIsOpen }) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        </div>
      </div>
    </header>
  );
}
