import type { Announcement } from '../../types';

interface AnnouncementsBannerProps {
  announcements: Announcement[];
}

const PRIORITY_STYLES: Record<Announcement['priority'], string> = {
  urgent: 'bg-red-700 text-white',
  high: 'bg-amber-600 text-white',
  normal: 'bg-blue-700 text-white',
  low: 'bg-gray-700 text-gray-200',
};

export default function AnnouncementsBanner({
  announcements,
}: AnnouncementsBannerProps) {
  if (announcements.length === 0) return null;

  return (
    <div className="space-y-3">
      {announcements.map((a) => (
        <div
          key={a.id}
          className={`flex items-start gap-4 px-6 py-4 rounded-xl ${PRIORITY_STYLES[a.priority]}`}
        >
          {/* Bell icon */}
          <span className="text-2xl flex-shrink-0" aria-hidden="true">
            🔔
          </span>

          <div className="min-w-0">
            <p className="text-xl font-bold truncate">{a.title}</p>
            {a.body && (
              <p className="text-lg mt-1 line-clamp-2">{a.body}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
