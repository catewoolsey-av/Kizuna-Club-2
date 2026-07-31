import React from "react";
import {
  Home,
  Calendar,
  Briefcase,
  Users,
  Settings,
  BarChart3,
  UserPlus,
  Megaphone,
  History,
  LogOut,
  Newspaper,
  FileText,
} from "lucide-react";
import { colors } from "../../constants/theme";

export default function Sidebar({
  currentView,
  setCurrentView,
  isOpen,
  setIsOpen,
  t,
  isAdmin,
  canBeAdmin,
  onToggleAdmin,
  onLogout,
  userProfile,
}) {
  const memberNav = [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "events", label: "Events", icon: Calendar },
    { id: "portfolio", label: "Fund Portfolio", icon: Briefcase },
    { id: "news-feed", label: "News Feed", icon: Newspaper },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "community", label: "Members", icon: Users },
    { id: "announcements", label: "Announcements", icon: Megaphone },
    { id: "profile", label: "My Profile", icon: Settings },
  ];

  const adminNav = [
    { id: "admin-dashboard", label: "Dashboard", icon: Home },
    { id: "admin-events", label: "Events", icon: Calendar },
    { id: "admin-deals", label: "Deals", icon: Briefcase },
    { id: "news-feed", label: "News Feed", icon: Newspaper },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "admin-members", label: "Members", icon: Users },
    { id: "admin-announcements", label: "Announcements", icon: Megaphone },
    { id: "admin-log", label: "Activity Log", icon: History },
  ];

  const userName =
    userProfile?.name || userProfile?.name_en || userProfile?.nameEn || "User";
  const userTitle = userProfile?.title || userProfile?.company || "";
  const userInitials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
        style={{ backgroundColor: colors.primary }}
      >
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: colors.accent }}
            >
              <span className="text-white font-bold text-lg">絆</span>
            </div>
            <div>
              <h1 className="text-white font-semibold text-sm">Kizuna Club</h1>
              <p className="text-gray-400 text-xs">Tokyo</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {isAdmin ? (
            <>
              {adminNav.map((item) => {
                const Icon = item.icon;
                const active = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentView(item.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      active
                        ? "text-white"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    }`}
                    style={active ? { backgroundColor: colors.accent } : {}}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </>
          ) : (
            memberNav.map((item) => {
              const Icon = item.icon;
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "text-white"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                  style={active ? { backgroundColor: colors.accent } : {}}
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })
          )}
        </nav>

        {/* Admin/Member toggle at bottom */}
        <div className="p-4 border-t border-white/10 space-y-3">
          {/* Two-button toggle */}
          {canBeAdmin && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (isAdmin) onToggleAdmin();
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  !isAdmin
                    ? "bg-white text-gray-900"
                    : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white"
                }`}
              >
                Member
              </button>
              <button
                onClick={() => {
                  if (!isAdmin) onToggleAdmin();
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  isAdmin
                    ? "text-white"
                    : "bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white"
                }`}
                style={isAdmin ? { backgroundColor: colors.accent } : {}}
              >
                Admin
              </button>
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 pt-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white font-medium text-sm"
              style={{ backgroundColor: colors.accent }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {userName}
              </p>
              <p className="text-gray-500 text-xs truncate">
                {isAdmin ? "Admin Mode" : "Member Mode"}
                {userTitle ? ` • ${userTitle}` : ""}
              </p>
            </div>
          </div>

          {/* Sign out button */}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
