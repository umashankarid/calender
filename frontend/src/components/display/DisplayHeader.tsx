import { useEffect, useState } from 'react';

interface DisplayHeaderProps {
  workspaceName: string;
}

const DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const MONTHS = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export default function DisplayHeader({ workspaceName }: DisplayHeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  const dayName = DAYS[now.getDay()];
  const day = now.getDate();
  const month = MONTHS[now.getMonth()];
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  return (
    <header className="flex items-center justify-between px-8 py-6 bg-gray-800 rounded-b-2xl">
      {/* Date */}
      <div>
        <p className="text-3xl font-bold tracking-wide">
          {dayName} {day} {month}
        </p>
      </div>

      {/* Workspace name */}
      <div className="text-center">
        <p className="text-2xl font-semibold text-gray-300">
          📅 {workspaceName}
        </p>
      </div>

      {/* Clock */}
      <div>
        <p className="text-4xl font-mono font-bold tabular-nums">
          {hours}:{minutes}
        </p>
      </div>
    </header>
  );
}
