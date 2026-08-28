import type { Reminder } from '../../types';

interface RemindersListProps {
  reminders: Reminder[];
}

function formatReminderTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function RemindersList({ reminders }: RemindersListProps) {
  if (reminders.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-2xl font-bold tracking-wide mb-3">REMINDERS</h3>

      {reminders.map((r) => (
        <div key={r.id} className="flex items-start gap-3 pl-2">
          {/* Clock icon */}
          <span className="text-xl flex-shrink-0 text-gray-400" aria-hidden="true">
            🕐
          </span>
          <div className="min-w-0">
            <p className="text-lg">
              <span className="text-gray-400 mr-2">
                {formatReminderTime(r.remind_at)}
              </span>
              <span className="font-medium">{r.message ?? 'Reminder'}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
