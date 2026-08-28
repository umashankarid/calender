import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWorkspace } from '../hooks/useWorkspace';
import WorkspaceSettings from '../components/admin/WorkspaceSettings';
import MemberManagement from '../components/admin/MemberManagement';
import CalendarManagement from '../components/admin/CalendarManagement';
import DisplayManagement from '../components/admin/DisplayManagement';
import GoogleCalendarSync from '../components/admin/GoogleCalendarSync';

type Tab = 'settings' | 'members' | 'calendars' | 'displays' | 'google';

const VALID_TABS: Tab[] = ['settings', 'members', 'calendars', 'displays', 'google'];

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  {
    key: 'settings',
    label: 'Settings',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.141 1.175-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.331-.274.779-.108 1.175s.506.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.424.07-.764.383-.93.78s-.142.844.107 1.174l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.33-.25-.779-.274-1.175-.108s-.71.506-.78.93l-.148.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93s-.844-.141-1.174.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.331.274-.779.108-1.175s-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.383.93-.78s.141-.844-.108-1.174l-.527-.738a1.125 1.125 0 01.12-1.45l.774-.773a1.125 1.125 0 011.449-.12l.738.527c.33.25.779.274 1.175.108s.71-.506.78-.93l.149-.894zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    key: 'members',
    label: 'Members',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    key: 'calendars',
    label: 'Calendars',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    key: 'displays',
    label: 'Displays',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    key: 'google',
    label: 'Google Calendar',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 010 6.364l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757" />
      </svg>
    ),
  },
];

function isValidTab(tab: string | null): tab is Tab {
  return tab !== null && VALID_TABS.includes(tab as Tab);
}

export default function AdminPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { workspace, members, calendars, loading, refetch } = useWorkspace(slug);

  // Read initial tab from ?tab= query param
  const tabParam = searchParams.get('tab');
  const initialTab: Tab = isValidTab(tabParam) ? tabParam : 'settings';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Sync tab state with URL param changes (e.g., from menu navigation)
  useEffect(() => {
    const newTab = searchParams.get('tab');
    if (isValidTab(newTab) && newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Workspace not found.</p>
          <Link to="/" className="text-sm text-indigo-600 hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 safe-area-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link
                to={`/${slug}`}
                className="flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors min-h-[44px] px-1"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Calendar
              </Link>
              <div className="h-5 w-px bg-gray-200 hidden sm:block" />
              <h1 className="text-sm font-semibold text-gray-900 hidden sm:block">{workspace.name}</h1>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Admin</span>
            </div>
            {user && (
              <div className="text-xs text-gray-400 hidden sm:block">
                {user.name}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="sm:hidden bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[48px] ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: Sidebar + Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-8">
          {/* Sidebar (desktop) */}
          <nav className="hidden sm:block w-56 flex-shrink-0">
            <div className="sticky top-6 space-y-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left ${
                    activeTab === tab.key
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={activeTab === tab.key ? 'text-indigo-600' : 'text-gray-400'}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}

              {/* Back to app link in sidebar */}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <Link
                  to={`/${slug}`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Calendar
                </Link>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'settings' && (
              <WorkspaceSettings workspace={workspace} onUpdated={refetch} />
            )}
            {activeTab === 'members' && (
              <MemberManagement slug={slug!} members={members} onChanged={refetch} />
            )}
            {activeTab === 'calendars' && (
              <CalendarManagement slug={slug!} calendars={calendars} onChanged={refetch} />
            )}
            {activeTab === 'displays' && (
              <DisplayManagement slug={slug!} />
            )}
            {activeTab === 'google' && (
              <GoogleCalendarSync slug={slug!} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
