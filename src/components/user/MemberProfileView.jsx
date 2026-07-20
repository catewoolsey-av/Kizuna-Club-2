import React from 'react';
import { colors } from "../../constants/theme";
import { Card, Badge } from "../../components/ui";
import { ChevronRight, Mail, MapPin } from 'lucide-react';

// Helper function to get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const MemberProfileView = ({ member, onBack, t, data }) => {
  // Early return if no member data
  if (!member) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Parse co-investors - can be array or string from database
  const parseCoInvestors = (coInvestorsData) => {
    if (!coInvestorsData) return [];
    
    // If it's already an array, process it
    if (Array.isArray(coInvestorsData)) {
      return coInvestorsData.map(item => {
        // Handle "Name|Type" format
        if (typeof item === 'string' && item.includes('|')) {
          const [name, type] = item.split('|');
          return { name: name?.trim() || '', type: type?.trim() || 'Partner' };
        }
        // Handle plain string
        return { name: item?.trim() || '', type: 'Partner' };
      }).filter(item => item.name);
    }
    
    // If it's a string, split by comma first
    if (typeof coInvestorsData === 'string') {
      return coInvestorsData.split(',').map(item => {
        const [name, type] = item.trim().split('|');
        return { name: name?.trim() || '', type: type?.trim() || 'Partner' };
      }).filter(item => item.name);
    }
    
    return [];
  };

  const coInvests = parseCoInvestors(member.coInvestors);
  const isLeader = member.isManager === true;
  
  return (
    <div className="max-w-3xl mx-auto pt-24 space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ChevronRight size={16} className="rotate-180" />{t.backToDashboard}
      </button>
      
      {/* Hero Card */}
      <Card>
        <div className="flex items-start gap-4 mb-6">
          <div className="w-24 h-24 rounded-xl flex items-center justify-center text-3xl font-bold shadow-lg" style={{ backgroundColor: isLeader ? '#FEF3C7' : colors.primary, color: isLeader ? '#92400E' : '#FFF' }}>
            {getInitials(member.nameEn || member.name)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{member.nameEn || member.name}</h2>
            {member.title && <p className="text-gray-600 text-lg">{member.title}</p>}
            {member.company && <p className="text-gray-500 text-base">{member.company}</p>}
          </div>
        </div>
        
        <div className="space-y-3">
          {member.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail size={16} className="text-gray-400" />
              {member.email}
            </div>
          )}
          {member.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              {member.phone}
            </div>
          )}
          {member.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin size={16} className="text-gray-400" />
              {member.location}
            </div>
          )}
          {member.linkedin && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
              <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                LinkedIn Profile
              </a>
            </div>
          )}
        </div>
        
        {/* Investment Interests - Members Only */}
        {!isLeader && member.interests && member.interests.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700 mb-2">{'Investment Interests'}</p>
            <div className="flex flex-wrap gap-2">
              {member.interests.map(i => <Badge key={i} variant="accent">{i}</Badge>)}
            </div>
          </div>
        )}
      </Card>
      
      {/* About/Bio Section - Both member types */}
      {member.bio && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">About</h3>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{member.bio}</p>
        </Card>
      )}
      
      {/* Notable Investments - Leaders Only */}
      {isLeader && member.notableInvestments && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Notable Investments</h3>
          <p className="text-gray-600">{member.notableInvestments}</p>
        </Card>
      )}
      
{/* Co-invests with - Leaders Only */}
      {isLeader && coInvests.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">{t.coinvestsWith || 'Co-invests with'}</h3>
          <div className="space-y-3">
            {coInvests.map((c, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-semibold" style={{ color: colors.primary }}>
                    {getInitials(c.name)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.type}</p>
                  </div>
                </div>
                <Badge variant="success">Active</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default MemberProfileView;
