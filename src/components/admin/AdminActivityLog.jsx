import React, { useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, Button, ConfirmModal, Toast } from '../ui';
import { UserPlus, Edit, Trash2, Archive, Send, Calendar, Users } from 'lucide-react';

export default function AdminActivityLog({ data, setData, addLog }) {
  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toast, setToast] = useState(null);
  const [clearing, setClearing] = useState(false);
  
  const INITIAL_DISPLAY_LIMIT = 25;

  // Icon mapping for different action types
  const getActionIcon = (type) => {
    const iconMap = {
      'add-member': UserPlus,
      'edit-member': Edit,
      'delete-member': Trash2,
      'archive-member': Archive,
      'add-deal': UserPlus,
      'edit-deal': Edit,
      'delete-deal': Trash2,
      'add-discussion': Calendar,
      'edit-discussion': Edit,
      'delete-discussion': Trash2,
      'send-reminder': Send,
      'add-announcement': Send,
      'edit-announcement': Edit,
      'delete-announcement': Trash2,
      'add-event': Calendar,
      'edit-event': Edit,
      'delete-event': Trash2,
      'add-recruit': Users,
      'edit-recruit': Edit,
      'delete-recruit': Trash2,
    };
    return iconMap[type] || Edit;
  };

  // Color mapping for different action types
  const getActionColor = (type) => {
    if (type.includes('add')) return 'bg-green-50 border-green-200';
    if (type.includes('edit')) return 'bg-blue-50 border-blue-200';
    if (type.includes('delete')) return 'bg-red-50 border-red-200';
    if (type.includes('archive')) return 'bg-gray-50 border-gray-200';
    if (type.includes('send')) return 'bg-purple-50 border-purple-200';
    return 'bg-gray-50 border-gray-200';
  };

  // Filter the logs based on selected filter
  const filteredLogs = useMemo(() => {
    if (!data?.activityLog) return [];
    if (filter === 'all') return data.activityLog;
    return data.activityLog.filter(log => {
      if (filter === 'members') return log.type && log.type.includes('member');
      if (filter === 'deals') return log.type && log.type.includes('deal');
      if (filter === 'discussions') return log.type && log.type.includes('discussion');
      if (filter === 'announcements') return log.type && log.type.includes('announcement');
      if (filter === 'events') return log.type && log.type.includes('event');
      if (filter === 'recruits') return log.type && log.type.includes('recruit');
      return true;
    });
  }, [data?.activityLog, filter]);

  // Limit displayed logs unless showAll is true
  const displayedLogs = showAll ? filteredLogs : filteredLogs.slice(0, INITIAL_DISPLAY_LIMIT);
  const hasMore = filteredLogs.length > INITIAL_DISPLAY_LIMIT;

  // Clear all activity logs
  const handleClearLog = async () => {
    setClearing(true);
    try {
      // Delete all activity logs from Supabase
      const { error } = await supabase.from('activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (error) throw error;
      
      // Clear local state
      setData((p) => ({ ...p, activityLog: [] }));
      setShowClearConfirm(false);
      setToast({ message: "Activity log cleared", type: "success" });
    } catch (err) {
      console.error('Error clearing log:', err);
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setClearing(false);
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Activity Log</h2>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Activities</option>
            <option value="members">Members</option>
            <option value="deals">Deals</option>
            <option value="discussions">Discussions</option>
            <option value="announcements">Announcements</option>
            <option value="events">Events</option>
            <option value="recruits">Recruits</option>
          </select>
          <Button 
            variant="outline" 
            icon={Trash2} 
            onClick={() => setShowClearConfirm(true)}
            disabled={!data?.activityLog || data.activityLog.length === 0}
          >
            Clear Log
          </Button>
        </div>
      </div>

      <Card>
        <div className="space-y-3">
          {displayedLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No activity logs found
            </div>
          ) : (
            <>
              {displayedLogs.map((log) => {
              const Icon = getActionIcon(log.type || 'edit');
              const colorClass = getActionColor(log.type || 'edit');
              
              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 p-3 border rounded-lg ${colorClass}`}
                >
                  <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                      <span>{log.user}</span>
                      <span>•</span>
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {hasMore && !showAll && (
              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAll(true)}
                  className="w-full"
                >
                  Load More ({filteredLogs.length - INITIAL_DISPLAY_LIMIT} more)
                </Button>
              </div>
            )}
            
            {showAll && hasMore && (
              <div className="pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAll(false)}
                  className="w-full"
                >
                  Show Less
                </Button>
              </div>
            )}
          </>
          )}
        </div>
      </Card>
      
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearLog}
        title="Clear Activity Log"
        message="Are you sure you want to clear all activity logs? This action cannot be undone."
        confirmText={clearing ? "Clearing..." : "Clear Log"}
        disabled={clearing}
      />
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
