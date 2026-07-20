import React, { useState } from 'react';
import { colors } from "../../constants/theme";
import { Card, Badge } from "../../components/ui";
import { supabase } from "../../lib/supabaseClient";
import { Calendar, Users, Briefcase, MessageSquare, ChevronRight, Star } from 'lucide-react';
import { formatDate } from "../../utils/date";

// Board password constant
const BOARD_PASSWORD = 'kizuna2024';

// Helper function to get initials from name
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const BoardView = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewDeal, setViewDeal] = useState(null);
  
  const handleLogin = () => {
    if (password === BOARD_PASSWORD) {
      setAuthenticated(true);
      setError('');
      loadData();
    } else {
      setError('Invalid password');
    }
  };
  
  const loadData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [membersRes, leadershipRes, fundRes, syndRes, discussionsRes, dinnersRes] = await Promise.all([
        supabase.from('members').select('*').order('name'),
        supabase.from('leadership').select('*').order('created_at'),
        supabase.from('fund_holdings').select('*').order('created_at'),
        supabase.from('syndication_deals').select('*').order('created_at'),
        supabase.from('discussions').select('*').order('date'),
        supabase.from('dinners').select('*').order('date'),
      ]);
      
      const mapMember = (m) => ({ ...m, nameEn: m.name_en, dealsViewed: m.deals_viewed, sessionsAttended: m.sessions_attended, lastLogin: m.last_login });
      const mapLeadership = (l) => ({ ...l, nameJa: l.name_ja, titleJa: l.title_ja, isManager: l.is_manager });
      const mapDeal = (d) => ({ ...d, companyName: d.name, companyNameJa: d.name_ja, sectorJa: d.sector_ja, descriptionJa: d.description_ja, checkSize: d.check_size, coInvestors: d.co_investors || [], ddComplete: d.dd_complete, ddReports: d.dd_reports || [] });
      
      setData({
        members: (membersRes.data || []).map(mapMember),
        leadership: (leadershipRes.data || []).map(mapLeadership),
        fundHoldings: (fundRes.data || []).map(mapDeal),
        syndicationDeals: (syndRes.data || []).map(mapDeal),
        discussions: discussionsRes.data || [],
        dinners: dinnersRes.data || [],
      });
    } catch (err) {
      console.error('Error loading board data:', err);
    }
    setLoading(false);
  };
  
  // Password gate
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: colors.primary }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl" style={{ backgroundColor: colors.accent }}>
              絆
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Kizuna Club</h1>
            <p className="text-gray-500">Board Member Access</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Enter board password"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleLogin}
              className="w-full py-3 rounded-lg font-medium text-white transition-all hover:opacity-90"
              style={{ backgroundColor: colors.accent }}
            >
              Access Board View
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">Read-only access for board members</p>
        </div>
      </div>
    );
  }
  
  // Loading
  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.primary }}>
        <div className="text-center text-white">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading board data...</p>
        </div>
      </div>
    );
  }
  
  // Deal detail view
  if (viewDeal) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: colors.accent }}>絆</div>
              <div>
                <h1 className="font-bold text-gray-900">Kizuna Club</h1>
                <p className="text-xs text-gray-500">Board View</p>
              </div>
            </div>
            <Badge variant="accent">Read Only</Badge>
          </div>
        </header>
        <main className="max-w-4xl mx-auto p-6">
          <button onClick={() => setViewDeal(null)} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
            <ChevronRight size={16} className="rotate-180" /> Back to Dashboard
          </button>
          <Card>
            <div className="flex items-start gap-4">
              <span className="text-4xl">{viewDeal.logo}</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{viewDeal.companyName}</h1>
                <p className="text-gray-600">{viewDeal.sector}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="accent">{viewDeal.stage}</Badge>
                </div>
              </div>
            </div>
            {viewDeal.description && <p className="text-gray-600 mt-4">{viewDeal.description}</p>}
            {viewDeal.coInvestors?.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Co-Investors</p>
                <div className="flex flex-wrap gap-2">
                  {viewDeal.coInvestors.map((inv) => (
                    <span key={inv} className="px-3 py-1 bg-gray-100 rounded-full text-sm">{inv}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Card className="text-center">
              <p className="text-xs text-gray-500">Valuation</p>
              <p className="text-lg font-semibold">
                {viewDeal.valuation || 'N/A'}
                {viewDeal.valuation && viewDeal.isPreMoney === true && <span className="text-xs text-gray-500 ml-1">(pre-money)</span>}
                {viewDeal.valuation && viewDeal.isPreMoney === false && <span className="text-xs text-gray-500 ml-1">(post-money)</span>}
              </p>
              {viewDeal.isApproximate && viewDeal.valuation && (
                <p className="text-[11px] text-gray-500 italic mt-1">To be finalized, discussions around {viewDeal.valuation} value</p>
              )}
            </Card>
          </div>
          {viewDeal.investmentThesis && (
            <Card className="mt-4">
              <h3 className="font-semibold text-gray-900 mb-2">Investment Thesis</h3>
              <p className="text-gray-600">{viewDeal.investmentThesis}</p>
            </Card>
          )}
        </main>
      </div>
    );
  }
  
  // Main board dashboard
  const totalMembers = data.members.length + data.leadership.length;
  const totalDeals = data.fundHoldings.length + data.syndicationDeals.length;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: colors.accent }}>絆</div>
            <div>
              <h1 className="font-bold text-gray-900">Kizuna Club</h1>
              <p className="text-xs text-gray-500">Board View — 2026 Cohort</p>
            </div>
          </div>
          <Badge variant="accent">Read Only</Badge>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Briefcase size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Fund Holdings</p>
                <p className="text-2xl font-bold text-gray-900">{data.fundHoldings.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Star size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Syndications</p>
                <p className="text-2xl font-bold text-gray-900">{data.syndicationDeals.length}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Calendar size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Upcoming Events</p>
                <p className="text-2xl font-bold text-gray-900">
                  {data.discussions.filter(d => d.is_upcoming !== false).length + data.dinners.filter(d => d.is_upcoming !== false).length}
                </p>
              </div>
            </div>
          </Card>
        </div>
        
        {/* Active Syndications */}
        {data.syndicationDeals.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Star size={20} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Active Syndications</h2>
              <Badge variant="primary">{data.syndicationDeals.length}</Badge>
            </div>
            <div className="space-y-3">
              {data.syndicationDeals.map(deal => (
                <div 
                  key={deal.id} 
                  onClick={() => setViewDeal(deal)} 
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{deal.logo}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{deal.companyName}</h3>
                        <p className="text-sm text-gray-500">{deal.sector}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="accent">{deal.stage}</Badge>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {/* Fund Holdings */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={20} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Kizuna Fund 1 Portfolio</h2>
            <Badge>{data.fundHoldings.length} companies</Badge>
          </div>
          {data.fundHoldings.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.fundHoldings.map(deal => (
                <div 
                  key={deal.id} 
                  onClick={() => setViewDeal(deal)} 
                  className="p-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:shadow-sm cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{deal.logo}</span>
                    <span className="font-medium text-gray-900 text-sm truncate">{deal.companyName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge>{deal.stage}</Badge>
                    <ChevronRight size={14} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No fund holdings yet</p>
          )}
        </Card>
        
        {/* Club Leadership */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">Alumni Ventures Team</h2>
            <Badge variant="accent">{data.leadership.length}</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.leadership.map(l => (
              <div key={l.id} className="text-center p-4 bg-amber-50 rounded-lg">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold mx-auto mb-2" style={{ backgroundColor: colors.accent, color: '#92400E' }}>
                  {getInitials(l.nameEn || l.name)}
                </div>
                <p className="font-medium text-gray-900 text-sm">{l.nameEn || l.name}</p>
                <p className="text-xs text-gray-500">{l.title}</p>
              </div>
            ))}
          </div>
        </Card>
        
        {/* Club Members */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Club Members</h2>
            <Badge>{data.members.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Interests</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.members.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ backgroundColor: colors.primary }}>
                          {getInitials(m.nameEn || m.name)}
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{m.nameEn || m.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{m.company}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{m.geography}</td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(m.interests || []).slice(0, 3).map(i => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{i}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        {/* Upcoming Events */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={20} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Group Discussions</h2>
            </div>
            {data.discussions.filter(d => d.is_upcoming !== false).length > 0 ? (
              <div className="space-y-3">
                {data.discussions.filter(d => d.is_upcoming !== false).map(d => (
                  <div key={d.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 text-sm">{d.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(d.date)} at {d.time} JST</p>
                    <p className="text-xs text-gray-400 mt-1">Host: {d.host}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No upcoming discussions</p>
            )}
          </Card>
          
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Events & Dinners</h2>
            </div>
            {data.dinners.filter(d => d.is_upcoming !== false).length > 0 ? (
              <div className="space-y-3">
                {data.dinners.filter(d => d.is_upcoming !== false).map(d => (
                  <div key={d.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 text-sm">{d.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(d.date)}</p>
                    <p className="text-xs text-gray-400 mt-1">{d.venue}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No upcoming events</p>
            )}
          </Card>
        </div>
        
        <p className="text-center text-xs text-gray-400 pt-4">Board View — Data refreshes on page load</p>
      </main>
    </div>
  );
};

export default BoardView;
