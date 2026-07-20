import React from 'react';
import { colors } from "../../constants/theme";
import { Card, Badge, Button } from "../../components/ui";
import { Users, Eye, Mail } from 'lucide-react';

// Helper function to get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const CommunityView = ({ t, onViewMember, data }) => {
  const visibleLeadership = (data.leadership || []).filter(l => l.profile_visible !== false);
  const avTeam = visibleLeadership.filter(l => !l.show_as_member);
  const memberRoleLeaders = visibleLeadership
    .filter(l => l.show_as_member)
    .map(l => ({ ...l, _isLeader: true }));
  const realMembers = data.members || [];
  const clubMembers = [...memberRoleLeaders, ...realMembers];
  
  return (
    <div className="space-y-8">
      {/* AV Team */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          AV Team
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {avTeam.map(l => (
            <Card key={l.id}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                  {getInitials(l.nameEn || l.name)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{l.nameEn || l.name}</h3>
                  <p className="text-sm text-gray-500">{l.title}</p>
                </div>
              </div>
              {l.email && (
                <a href={`mailto:${l.email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-3">
                  <Mail size={14} />{l.email}
                </a>
              )}
              <Button variant="outline" size="sm" className="w-full" icon={Eye} onClick={() => onViewMember(l)}>
                {t.viewProfile}
              </Button>
            </Card>
          ))}
        </div>
      </div>
      
      {/* Club Members */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users size={20} className="text-emerald-600" />
          {t.memberDirectory}
          <span className="text-sm font-normal text-gray-500">({clubMembers.length} members)</span>
        </h2>
        {clubMembers.length === 0 ? (
          <Card><p className="text-center text-gray-500 py-8">No club members yet</p></Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clubMembers.map(m => {
              const isLeaderRow = m._isLeader === true;
              return (
              <Card key={m.id}>
                <div className="flex items-center gap-4 mb-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold"
                    style={
                      isLeaderRow
                        ? { backgroundColor: '#FEF3C7', color: '#92400E' }
                        : { backgroundColor: colors.primary, color: '#fff' }
                    }
                  >
                    {getInitials(m.nameEn || m.name)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{m.nameEn || m.name}</h3>
                    <p className="text-sm text-gray-500">{isLeaderRow ? m.title : m.company}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {m.interests?.map(i => <Badge key={i}>{i}</Badge>)}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" icon={Eye} onClick={() => onViewMember(isLeaderRow ? { ...m, isManager: true } : m)}>
                    {t.viewProfile}
                  </Button>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityView;
