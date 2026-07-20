import React from "react";
import { colors } from "../../constants/theme";
import { Card } from "../../components/ui";
import {
  Users,
  UserPlus,
  Star,
  Briefcase,
  CalendarPlus,
  Megaphone,
} from "lucide-react";
import { formatDateTime } from "../../utils/date";

const AdminDashboard = ({ t, setCurrentView, data }) => {
  const clubMembers = data.members.filter((m) => !m.is_board);
  const activeSyndications = (data.syndicationDeals || []).filter(
    (d) => d.syndicationStatus !== "past"
  );
  const stats = [
    { label: "Club Members", value: clubMembers.length, icon: Users, color: "blue" },
    { label: "Active Syndications", value: activeSyndications.length, icon: Star, color: "purple" },
    { label: "Fund Holdings", value: data.fundHoldings.length, icon: Briefcase, color: "emerald" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const bg =
            s.color === "blue"
              ? "bg-blue-100"
              : s.color === "emerald"
              ? "bg-emerald-100"
              : s.color === "purple"
              ? "bg-purple-100"
              : s.color === "cyan"
              ? "bg-cyan-100"
              : "bg-amber-100";
          const tc =
            s.color === "blue"
              ? "text-blue-600"
              : s.color === "emerald"
              ? "text-emerald-600"
              : s.color === "purple"
              ? "text-purple-600"
              : s.color === "cyan"
              ? "text-cyan-600"
              : "text-amber-600";

          return (
            <Card key={s.label}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center`}>
                  <Icon size={20} className={tc} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t.quickActions}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { id: "admin-events", label: "Add/Edit Events", icon: CalendarPlus, bg: "bg-purple-100", fg: "text-purple-600" },
            { id: "admin-deals", label: "Add/Edit Deals", icon: Briefcase, bg: "bg-emerald-100", fg: "text-emerald-600" },
            { id: "admin-members", label: "Add/Edit Members", icon: UserPlus, bg: "bg-blue-100", fg: "text-blue-600" },
            { id: "admin-announcements", label: t.createAnnouncement, icon: Megaphone, bg: "bg-amber-100", fg: "text-amber-600" },
          ].map((qa) => {
            const Icon = qa.icon;
            return (
              <button
                key={qa.id}
                type="button"
                onClick={() => setCurrentView(qa.id)}
                className="group flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`w-9 h-9 rounded-lg ${qa.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={18} className={qa.fg} />
                </div>
                <span className="font-medium text-gray-800 text-sm">{qa.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">{t.recentActivity}</h3>
        <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {data.activityLog.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">{"No activity yet"}</p>
          ) : (
            data.activityLog.slice(0, 25).map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-100 last:border-b-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 truncate">{log.details}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {log.user}{log.timestamp ? ` · ${formatDateTime(log.timestamp)}` : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
