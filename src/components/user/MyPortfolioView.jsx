import React from 'react';
import { Card, Badge, Button } from "../../components/ui";
import { ChevronRight, Star } from 'lucide-react';
import { formatDate } from "../../utils/date";
import { supabase } from "../../lib/supabaseClient";

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

const MyPortfolioView = ({ t, onViewDeal, data, userProfile }) => {
  // Helper function to parse monetary values
  const parseMonetary = (value) => {
    if (!value) return 0;
    const cleanValue = String(value).replace(/[$¥,]/g, '').trim().toUpperCase();
    if (cleanValue.endsWith('M')) {
      return parseFloat(cleanValue.slice(0, -1)) * 1000000;
    } else if (cleanValue.endsWith('K')) {
      return parseFloat(cleanValue.slice(0, -1)) * 1000;
    } else if (cleanValue.endsWith('B')) {
      return parseFloat(cleanValue.slice(0, -1)) * 1000000000;
    }
    return parseFloat(cleanValue) || 0;
  };

  // Detect currency from amount string
  const detectCurrency = (amount) => {
    if (!amount) return 'USD';
    const amountStr = String(amount);
    if (amountStr.includes('¥') || amountStr.includes('JPY')) return 'JPY';
    if (amountStr.includes('$') || amountStr.includes('USD')) return 'USD';
    // Default to USD if no currency symbol found
    return 'USD';
  };

  // Helper to format numbers back to readable format
  const formatMonetary = (value, currency = 'USD') => {
    const num = typeof value === 'string' ? parseMonetary(value) : (typeof value === 'number' ? value : parseMonetary(value));
    if (!num || num === 0) return currency === 'JPY' ? '¥0' : '$0';
    
    const symbol = currency === 'JPY' ? '¥' : '$';
    
    if (num >= 1000000000) {
      return `${symbol}${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `${symbol}${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${symbol}${(num / 1000).toFixed(0)}K`;
    }
    return `${symbol}${num.toLocaleString()}`;
  };

  // Get member's investments from memberInvestments
  const myInvestments = (data.memberInvestments || []).filter(inv => inv.memberId === userProfile?.id);
  
  // DEBUG: Log investment data for troubleshooting
  console.log('=== MY PORTFOLIO DEBUG ===');
  console.log('Total memberInvestments in data:', data.memberInvestments?.length);
  console.log('UserProfile ID:', userProfile?.id);
  console.log('UserProfile Name:', userProfile?.name);
  console.log('Filtered investments for this user:', myInvestments.length);
  if (myInvestments.length > 0) {
    console.log('Investment details:', myInvestments);
  } else {
    console.log('No investments found. All member_ids in data:', data.memberInvestments?.map(i => ({ id: i.memberId, name: i.memberName })));
  }
  
  const allDeals = [...(data.fundHoldings || []), ...(data.syndicationDeals || [])];
  
  // Enrich investments with deal info and currency
  const enrichedInvestments = myInvestments.map(inv => {
    const deal = allDeals.find(d => d.id === inv.dealId);
    const currency = detectCurrency(inv.amount);
    return { ...inv, deal, currency };
  }).filter(inv => inv.deal);

  // Group investments by currency
  const investmentsByCurrency = enrichedInvestments.reduce((acc, inv) => {
    if (!acc[inv.currency]) {
      acc[inv.currency] = [];
    }
    acc[inv.currency].push(inv);
    return acc;
  }, {});

  // Calculate totals per currency
  const totalsByCurrency = Object.keys(investmentsByCurrency).reduce((acc, currency) => {
    const investments = investmentsByCurrency[currency];
    const total = investments.reduce((sum, inv) => sum + parseMonetary(inv.amount), 0);
    acc[currency] = total;
    return acc;
  }, {});

  // Overall stats
  const totalInvestments = enrichedInvestments.length;
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">My Portfolio</h2>
        <p className="text-gray-600">Temporary Hold: to connect to investor portal.</p>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <p className="text-2xl font-bold text-gray-900">{totalInvestments}</p>
          <p className="text-xs text-gray-500">Investments</p>
        </Card>
        <Card>
          <div className="space-y-1">
            {Object.keys(totalsByCurrency).length > 0 ? (
              Object.keys(totalsByCurrency).map(currency => (
                <div key={currency} className="mb-2 last:mb-0">
                  <p className="text-2xl font-bold text-gray-900">{formatMonetary(totalsByCurrency[currency], currency)}</p>
                  <p className="text-xs text-gray-500">{currency} Total</p>
                </div>
              ))
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">$0 / ¥0</p>
                <p className="text-xs text-gray-500">Total Invested</p>
              </>
            )}
          </div>
        </Card>
      </div>
      
      {enrichedInvestments.length > 0 ? (
        <>
          {/* Render sections by currency */}
          {Object.keys(investmentsByCurrency).sort().map(currency => (
            <div key={currency} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {currency === 'JPY' ? 'Japanese Yen (¥) Investments' : 'US Dollar ($) Investments'}
                </h3>
                <p className="text-sm text-gray-500">
                  {investmentsByCurrency[currency].length} {investmentsByCurrency[currency].length === 1 ? 'investment' : 'investments'} • {formatMonetary(totalsByCurrency[currency], currency)}
                </p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {investmentsByCurrency[currency].map(inv => {
                  const logoUrl = getLogoUrl(inv.deal.logo);
                  const isImageUrl = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
                  
                  return (
                    <Card key={inv.id}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Logo - only show if uploaded image */}
                          {isImageUrl && (
                            <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                              <img 
                                src={logoUrl} 
                                alt={inv.deal.companyName} 
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}
                          {/* Company info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900">{inv.deal.companyName}</h3>
                            <p className="text-sm text-gray-500">{inv.deal.sector}</p>
                          </div>
                        </div>
                        <Badge variant="success">{inv.deal.stage}</Badge>
                      </div>
                      <div className="space-y-1 mb-3">
                        <p className="text-sm text-gray-600">
                          Investment: <span className="font-medium">{formatMonetary(inv.amount, currency)}</span>
                        </p>
                        <p className="text-sm text-gray-500">Date: {formatDate(inv.date)}</p>
                      </div>
                      <Button 
                        variant="primary" 
                        size="sm" 
                        className="w-full" 
                        icon={ChevronRight} 
                        onClick={() => onViewDeal(inv.deal)}
                      >
                        View Details
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      ) : (
        <Card className="text-center py-12">
          <Star size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No investments yet</h3>
          <p className="text-gray-500 mb-4">Browse active syndications to find investment opportunities</p>
        </Card>
      )}
    </div>
  );
};

export default MyPortfolioView;
