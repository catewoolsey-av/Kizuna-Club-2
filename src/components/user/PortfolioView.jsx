import React from 'react';
import { Card, Badge, Button } from "../../components/ui";
import { ChevronRight, Briefcase, Star } from 'lucide-react';
import { supabase } from "../../lib/supabaseClient";

const SHOW_MEMBER_ACTIVE_SYNDICATIONS = false;

// Helper to get logo URL from storage
const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath; // Already a full URL
  if (logoPath.length <= 4) return logoPath; // Emoji (we won't display these)
  
  // It's a storage path, construct the public URL
  const { data } = supabase.storage
    .from('company-logos')
    .getPublicUrl(logoPath);
  
  return data.publicUrl;
};

const PortfolioView = ({ t, onViewDeal, data }) => {
  const fundHoldings = data.fundHoldings || [];
  const activeSyndications = (data.syndicationDeals || []).filter(d => d.syndicationStatus !== 'past');
  
  // Helper to format monetary values
  const formatMonetary = (value) => {
    if (!value || value === 0) return 'N/A';
    // Handle both numeric and string values from database
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 'N/A';
    
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(0)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };
  
  return (
    <div className="space-y-8">
      {/* Fund Holdings Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase size={20} className="text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Fund Holdings</h2>
        </div>
        <p className="text-gray-600 mb-4">{fundHoldings.length} portfolio companies</p>
        {fundHoldings.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {fundHoldings.map(h => {
              const logoUrl = getLogoUrl(h.logo);
              const isImageUrl = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
              
              return (
                <Card key={h.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Logo - only show if uploaded image */}
                      {isImageUrl && (
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                          <img 
                            src={logoUrl} 
                            alt={h.companyName} 
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {/* Company info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{h.companyName}</h3>
                        <p className="text-sm text-gray-500">{h.sector || 'N/A'}</p>
                      </div>
                    </div>
                    <Badge variant="primary">{h.stage}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Valuation: {formatMonetary(h.valuation)}
                    {h.valuation && h.isPreMoney === true && <span className="text-xs text-gray-500"> (pre-money)</span>}
                    {h.valuation && h.isPreMoney === false && <span className="text-xs text-gray-500"> (post-money)</span>}
                    {h.isApproximate && h.valuation && (
                      <span className="text-[11px] text-gray-500 italic ml-2">— To be finalized, discussions around {formatMonetary(h.valuation)} value</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mb-3 truncate">
                    Co-Investors: {h.coInvestors && h.coInvestors.length > 0 ? h.coInvestors.join(', ') : 'N/A'}
                  </p>
                  <Button variant="primary" size="sm" className="w-full" icon={ChevronRight} onClick={() => onViewDeal(h)}>
                    {t.more}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <p className="text-gray-500 text-center py-8">No fund holdings yet</p>
          </Card>
        )}
      </div>

      {/* Active Syndications Section */}
      {SHOW_MEMBER_ACTIVE_SYNDICATIONS && (
        <div>
        <div className="flex items-center gap-2 mb-4">
          <Star size={20} className="text-amber-600" />
          <h2 className="text-xl font-semibold text-gray-900">Active Syndications</h2>
        </div>
        <p className="text-gray-600 mb-4">{activeSyndications.length} investment opportunities</p>
        {activeSyndications.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-4">
            {activeSyndications.map(h => {
              const logoUrl = getLogoUrl(h.logo);
              const isImageUrl = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
              
              return (
                <Card key={h.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Logo - only show if uploaded image */}
                      {isImageUrl && (
                        <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                          <img 
                            src={logoUrl} 
                            alt={h.companyName} 
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {/* Company info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{h.companyName}</h3>
                        <p className="text-sm text-gray-500">{h.sector || 'N/A'}</p>
                      </div>
                    </div>
                    <Badge variant="accent">{h.stage}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Valuation: {formatMonetary(h.valuation)}
                    {h.valuation && h.isPreMoney === true && <span className="text-xs text-gray-500"> (pre-money)</span>}
                    {h.valuation && h.isPreMoney === false && <span className="text-xs text-gray-500"> (post-money)</span>}
                    {h.isApproximate && h.valuation && (
                      <span className="text-[11px] text-gray-500 italic ml-2">— To be finalized, discussions around {formatMonetary(h.valuation)} value</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 mb-3 truncate">
                    Co-Investors: {h.coInvestors && h.coInvestors.length > 0 ? h.coInvestors.join(', ') : 'N/A'}
                  </p>
                  <Button variant="accent" size="sm" className="w-full" icon={ChevronRight} onClick={() => onViewDeal(h)}>
                    {t.more}
                  </Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <p className="text-gray-500 text-center py-8">No active syndications</p>
          </Card>
        )}
        </div>
      )}
    </div>
  );
};

export default PortfolioView;
