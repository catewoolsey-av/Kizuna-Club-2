import React, { useState, useEffect, useRef } from 'react';
import { supabase } from "../../lib/supabaseClient";
import { Card, Badge, Button, Toast, Modal } from "../../components/ui";
import { ChevronRight, MessageSquare, CheckCircle, ExternalLink, Upload, X, FileText, Eye, Maximize2, Minimize2 } from 'lucide-react';
import { formatDate } from "../../utils/date";

// Helper to get logo URL from storage or return as-is
const getLogoUrl = (logoPath) => {
  if (!logoPath) return null;
  if (logoPath.startsWith('http')) return logoPath; // Already a full URL
  if (logoPath.length <= 4) return logoPath; // Emoji
  
  // It's a storage path, construct the public URL
  const { data } = supabase.storage
    .from('company-logos')
    .getPublicUrl(logoPath);
  
  return data.publicUrl;
};

const DealDetailPage = ({ deal, onBack, t, isSyndication, userProfile, backLabel }) => {
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingInterest, setExistingInterest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvestModal, setShowInvestModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [investmentForm, setInvestmentForm] = useState({
    amountType: 'up_to',
    amount: '',
    notes: ''
  });
  const [passForm, setPassForm] = useState({ notes: '' });
  const descriptionText = deal?.description || '';
  const descriptionPreviewLimit = 600;
  const isDescriptionTruncated = descriptionText.length > descriptionPreviewLimit;
  const coInvestorsText = deal?.coInvestors && deal.coInvestors.length > 0 ? deal.coInvestors.join(', ') : 'N/A';
  const descriptionLineClamp = coInvestorsText.length > 80 ? 8 : 10;

  // Helper to ensure URL has protocol
  const ensureUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return 'https://' + url;
  };

  // Check for existing interest on load
  useEffect(() => {
    const checkExistingInterest = async () => {
      if (!userProfile || !deal) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('deal_interests')
          .select('*')
          .eq('member_id', userProfile.id)
          .eq('deal_id', deal.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error checking existing interest:', error);
        }

        if (data) {
          setExistingInterest(data);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkExistingInterest();
  }, [userProfile, deal]);
  
  // Helper to format monetary values
  const formatMonetary = (value) => {
    if (!value) return 'N/A';
    // Handle both numeric and string values from database
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num) || num === 0) return 'N/A';
    
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(1)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(0)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return `$${num.toLocaleString()}`;
  };
  
  const handleInterest = async (type) => {
    if (!userProfile) {
      setToast({ message: 'Please log in to express interest', type: 'error' });
      return;
    }

    const existingType = existingInterest?.interest_type === 'learn_more' ? 'pass' : existingInterest?.interest_type;
    const dealClosed = deal.syndicationStatus === 'past';
    const isContacted = existingInterest?.status === 'contacted' || existingInterest?.status === 'completed';

    if (dealClosed) {
      setToast({ message: 'This deal is closed. You can no longer change your response.', type: 'info' });
      return;
    }

    if (existingInterest) {
      if (type === 'invest' && existingType === 'invest') {
        setToast({ message: 'You already expressed investment interest in this deal', type: 'info' });
        return;
      }
      
      if (type === 'pass' && existingType === 'pass') {
        setToast({ message: 'You already passed on this deal', type: 'info' });
        return;
      }

      if (type === 'pass' && existingType === 'invest' && isContacted) {
        setToast({ message: 'You can no longer switch to pass after being contacted.', type: 'info' });
        return;
      }
    }

    // If invest, show modal to collect details
    if (type === 'invest') {
      setShowInvestModal(true);
      setInvestmentForm({ amountType: 'up_to', amount: '', notes: '' });
      return;
    }

    if (type === 'pass') {
      setShowPassModal(true);
      setPassForm({ notes: '' });
      return;
    }
  };

  const submitInterest = async (interestType, investmentData) => {
    setSubmitting(true);
    
    try {
      const dbInterestType = interestType === 'pass' ? 'learn_more' : interestType;
      const interestData = {
        member_id: userProfile.id,
        member_name: userProfile.name || userProfile.nameEn || userProfile.email,
        member_email: userProfile.email,
        deal_id: deal.id,
        deal_name: deal.companyName,
        interest_type: dbInterestType,
        status: 'pending'
      };

      // Add investment details if provided
      if (interestType === 'invest' && investmentData) {
        const messageParts = [];
        if (investmentData.amountType === 'max') {
          messageParts.push('Investment Amount: Maximum Available Allocation');
        } else if (investmentData.amount) {
          messageParts.push(`Investment Amount: $${investmentData.amount}`);
        }
        if (investmentData.notes?.trim()) {
          messageParts.push(`Notes: ${investmentData.notes.trim()}`);
        }
        if (messageParts.length > 0) {
          interestData.message = messageParts.join('\n');
        }
      }

      if (interestType === 'pass' && investmentData?.notes?.trim()) {
        interestData.message = `Notes: ${investmentData.notes.trim()}`;
      }

      console.log('Submitting interest:', interestData);

      // If upgrading from pass to invest, update existing
      const existingType = existingInterest?.interest_type === 'learn_more' ? 'pass' : existingInterest?.interest_type;
      if (existingInterest && ((interestType === 'invest' && existingType !== 'invest') || interestType === 'pass')) {
        const { error } = await supabase
          .from('deal_interests')
          .update({
            interest_type: dbInterestType,
            message: interestData.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingInterest.id);

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        setExistingInterest({
          ...existingInterest,
          interest_type: dbInterestType,
          message: interestData.message
        });
      } else {
        // New submission
        const { data, error } = await supabase
          .from('deal_interests')
          .insert(interestData)
          .select()
          .single();

        if (error) {
          console.error('Database error:', error);
          throw error;
        }

        setExistingInterest(data);
      }

      const message = interestType === 'pass'
        ? 'Pass recorded. Club leadership has been notified.'
        : 'Investment interest recorded! Club leadership will reach out with next steps.';
      
      setToast({ message, type: 'success' });
      setShowInvestModal(false);
      setShowPassModal(false);
      setInvestmentForm({ amountType: 'up_to', amount: '', notes: '' });
      setPassForm({ notes: '' });
      
    } catch (err) {
      console.error('Error recording interest:', err);
      setToast({ message: 'Error submitting interest. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvestSubmit = (e) => {
    e.preventDefault();
    
    if (investmentForm.amountType === 'up_to') {
      if (!investmentForm.amount) {
        setToast({ message: 'Please enter an investment amount', type: 'error' });
        return;
      }
      const numericAmount = parseInt(investmentForm.amount.replace(/,/g, ''), 10);
      if (!Number.isFinite(numericAmount) || numericAmount < 25000) {
        setToast({ message: 'Minimum check is 25k', type: 'error' });
        return;
      }
    }

    submitInterest('invest', investmentForm);
  };

  const handlePassSubmit = (e) => {
    e.preventDefault();
    submitInterest('pass', passForm);
  };

  const normalizedInterestType = existingInterest?.interest_type === 'learn_more' ? 'pass' : existingInterest?.interest_type;
  const dealClosed = deal.syndicationStatus === 'past';
  const isContacted = existingInterest?.status === 'contacted' || existingInterest?.status === 'completed';
  const canSwitchToPass = normalizedInterestType === 'invest' && !isContacted && !dealClosed;
  const canSwitchToInvest = normalizedInterestType === 'pass' && !dealClosed;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900">
        <ChevronRight size={16} className="rotate-180" />{backLabel || t.backToPortfolio}
      </button>
      
      {/* Header with logo, name, sector, stage */}
      <Card>
        <div className="flex items-start gap-4">
          {(() => {
            const logoUrl = getLogoUrl(deal.logo);
            const isImageUrl = logoUrl && (logoUrl.startsWith('http://') || logoUrl.startsWith('https://'));
            
            if (isImageUrl) {
              return (
                <div className="w-20 h-20 flex items-center justify-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0 bg-white">
                  <img 
                    src={logoUrl} 
                    alt={deal.companyName} 
                    className="max-w-full max-h-full object-contain p-2"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              );
            }
            return null;
          })()}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{deal.companyName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-gray-600">{deal.sector}</span>
              <Badge variant="accent">{deal.stage}</Badge>
              {isSyndication && <Badge variant="primary">{'Syndication'}</Badge>}
            </div>
            {deal.companyWebsite && (
              <a
                href={ensureUrl(deal.companyWebsite)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3"
              >
                <ExternalLink size={14} />
                Company Website
              </a>
            )}
          </div>
        </div>
      </Card>

      {/* Description - full width */}
      {descriptionText && (
        <Card>
          <p
            className="text-gray-600 leading-relaxed"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 8,
              overflow: 'hidden'
            }}
          >
            <span className="font-medium text-gray-700">Description:</span> {descriptionText}
          </p>
          {isDescriptionTruncated && (
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => setShowDescriptionModal(true)}>
                See more
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Key Details */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Key Details</h3>
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">{t.valuation}</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatMonetary(deal.valuation)}
              {deal.valuation && deal.isPreMoney === true && <span className="text-xs text-gray-500 ml-1">(pre-money)</span>}
              {deal.valuation && deal.isPreMoney === false && <span className="text-xs text-gray-500 ml-1">(post-money)</span>}
            </p>
            {deal.isApproximate && deal.valuation && (
              <p className="text-[11px] text-gray-500 italic mt-1">To be finalized, discussions around {formatMonetary(deal.valuation)} value</p>
            )}
          </div>
          {(deal.yearEstablished || deal.city || deal.country) && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500 mb-2">Company Details</p>
              <div className="space-y-1 text-sm text-gray-700">
                {deal.yearEstablished && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Year Established:</span>
                    <span className="font-medium text-gray-900">{deal.yearEstablished}</span>
                  </div>
                )}
                {deal.city && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">City:</span>
                    <span className="font-medium text-gray-900">{deal.city}</span>
                  </div>
                )}
                {deal.country && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Country:</span>
                    <span className="font-medium text-gray-900">{deal.country}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {coInvestorsText !== 'N/A' && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">{t.coInvestors}</p>
              <p className="text-sm text-gray-700">{coInvestorsText}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Interest buttons for syndications */}
      {isSyndication && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-4">{'Interested in this deal?'}</h3>
          
          {/* Show existing interest status */}
          {existingInterest && (
            <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-medium text-gray-900">
                  {existingInterest.status === 'completed' && existingInterest.interest_type === 'invest'
                    ? "You've invested in this"
                    : normalizedInterestType === 'invest' 
                      ? "You've expressed investment interest" 
                      : "You've passed on this deal"}
                </span>
              </div>
              {normalizedInterestType === 'invest' && isContacted && (
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  You've been contacted about your interest.
                </p>
              )}
            </div>
          )}
          
          {/* Only show buttons if not completed */}
          {(!existingInterest || existingInterest.status !== 'completed') && (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant={normalizedInterestType === 'invest' ? 'primary' : 'outline'}
                  icon={CheckCircle} 
                  onClick={() => handleInterest('invest')} 
                  disabled={submitting || loading || dealClosed || normalizedInterestType === 'invest'}
                  className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : "Invest"}
                </Button>
                <Button 
                  variant={normalizedInterestType === 'pass' ? 'primary' : 'outline'}
                  icon={MessageSquare} 
                  onClick={() => handleInterest('pass')} 
                  disabled={submitting || loading || dealClosed || normalizedInterestType === 'pass' || (normalizedInterestType === 'invest' && !canSwitchToPass)}
                  className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : "Pass"}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-3 text-center">{'Club leadership will be notified'}</p>
            </>
          )}
        </Card>
      )}

      <Modal isOpen={showDescriptionModal} onClose={() => setShowDescriptionModal(false)} title="Company Description" size="lg">
        <p className="text-gray-700 leading-relaxed whitespace-pre-line">{descriptionText}</p>
      </Modal>
      

      {/* Investment Modal */}
      {showInvestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Investment Interest</h3>
              <button 
                onClick={() => setShowInvestModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              You're expressing interest to invest in <span className="font-semibold">{deal.companyName}</span>. We will follow up with you to discuss next steps.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 mb-4">
              <span className="font-semibold">Note:</span> Allocation is not guaranteed. Depending on demand and allocation policy, you may receive less than your requested amount; this is a requested reservation only.
            </div>

            <form onSubmit={handleInvestSubmit} className="space-y-4">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Investment Amount *</label>
                <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${investmentForm.amountType === 'up_to' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="investment-amount-type"
                    value="up_to"
                    checked={investmentForm.amountType === 'up_to'}
                    onChange={() => setInvestmentForm(f => ({ ...f, amountType: 'up_to' }))}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Up To $</p>
                    <input
                      type="text"
                      value={investmentForm.amount}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d,]/g, '');
                        setInvestmentForm({...investmentForm, amount: value});
                      }}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                      placeholder="e.g., 50000"
                      disabled={investmentForm.amountType !== 'up_to'}
                    />
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer ${investmentForm.amountType === 'max' ? 'border-blue-500 bg-blue-50/40' : 'border-gray-200'}`}>
                  <input
                    type="radio"
                    name="investment-amount-type"
                    value="max"
                    checked={investmentForm.amountType === 'max'}
                    onChange={() => setInvestmentForm(f => ({ ...f, amountType: 'max' }))}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Maximum Available Allocation</p>
                    <p className="text-sm text-gray-500">Request the maximum amount available</p>
                  </div>
                </label>

                <p className="text-sm text-gray-500">Minimum check: 25k</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Notes (optional)</label>
                <textarea
                  value={investmentForm.notes}
                  onChange={(e) => setInvestmentForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Add any notes here..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInvestModal(false)}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pass Modal */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">Pass on Deal</h3>
              <button 
                onClick={() => setShowPassModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-4">
              You're passing on <span className="font-semibold">{deal.companyName}</span>.
            </p>

            <form onSubmit={handlePassSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1">Notes (optional)</label>
                <textarea
                  value={passForm.notes}
                  onChange={(e) => setPassForm({ notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Not in my investment thesis, valuation concerns, etc."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPassModal(false)}
                  className="flex-1"
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Viewer (resizable, fullscreen-capable, no print/download toolbar) */}
      {showDocumentModal && (
        <DocumentViewer
          url={documentUrl}
          title={documentTitle}
          onClose={() => {
            setShowDocumentModal(false);
            setDocumentUrl('');
            setDocumentTitle('');
          }}
        />
      )}
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const DocumentViewer = ({ url, title, onClose }) => {
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.();
    }
  };

  // Hash params hide the built-in PDF viewer toolbar (print/download) in Chromium-based browsers.
  // Safe for non-PDF URLs — browsers ignore unknown fragments.
  const sep = url.includes('#') ? '&' : '#';
  const viewerUrl = url ? `${url}${sep}toolbar=0&navpanes=0&scrollbar=0` : '';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="bg-white rounded-xl flex flex-col shadow-xl"
        style={{
          width: isFullscreen ? '100vw' : '70vw',
          height: isFullscreen ? '100vh' : '85vh',
          minWidth: 320,
          minHeight: 240,
          maxWidth: '100vw',
          maxHeight: '100vh',
          resize: isFullscreen ? 'none' : 'both',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              type="button"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
              title="Close"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 relative bg-gray-100">
          {viewerUrl && (
            <iframe
              src={viewerUrl}
              className="w-full h-full border-0"
              title={title}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DealDetailPage;
