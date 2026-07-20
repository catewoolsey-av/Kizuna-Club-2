import React, { useEffect, useRef } from 'react';
import { colors } from "../../constants/theme";
import { Card, Badge } from "../../components/ui";
import { Megaphone } from 'lucide-react';
import { formatDate } from "../../utils/date";

const AnnouncementsView = ({ t, data }) => {
  // Get all published announcements, sorted with pinned first
  const announcements = data.announcements
    .filter(a => a.status === 'published')
    .sort((a, b) => {
      // Pinned announcements come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then sort by date (most recent first)
      return new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp);
    });

  const highlightedIdRef = useRef(sessionStorage.getItem('scrollToAnnouncement'));

  useEffect(() => {
    const targetId = highlightedIdRef.current;
    if (!targetId) return;
    sessionStorage.removeItem('scrollToAnnouncement');
    // Defer to next frame so the cards have mounted.
    requestAnimationFrame(() => {
      const el = document.getElementById(`announcement-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-offset-2');
        el.style.setProperty('--tw-ring-color', colors.accent);
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-offset-2');
          el.style.removeProperty('--tw-ring-color');
        }, 2000);
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: colors.accent }}
        >
          <Megaphone size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-500">Stay updated with the latest news</p>
        </div>
      </div>

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card>
            <div className="py-12 text-center">
              <Megaphone size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No announcements yet</p>
            </div>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} id={`announcement-${announcement.id}`} className="scroll-mt-24 rounded-xl transition-shadow">
              <Card>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {announcement.title}
                        </h3>
                        {announcement.pinned && (
                          <Badge variant="primary">Pinned</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {announcement.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-400">
                      {announcement.author || 'Unknown'} · {formatDate(announcement.createdAt || announcement.timestamp)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AnnouncementsView;
