import { vi, describe, it, expect } from 'vitest';
import { mockAnnouncement } from '../../../test/mocks';

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '../../../test/test-utils';
import AnnouncementsBanner from '../AnnouncementsBanner';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AnnouncementsBanner', () => {
  it('renders announcement title and body', () => {
    const announcement = mockAnnouncement({
      title: 'Office Closed Friday',
      body: 'The office will be closed this Friday for maintenance.',
    });
    render(<AnnouncementsBanner announcements={[announcement]} />);
    expect(screen.getByText('Office Closed Friday')).toBeInTheDocument();
    expect(
      screen.getByText('The office will be closed this Friday for maintenance.'),
    ).toBeInTheDocument();
  });

  it('applies urgent styling for urgent priority', () => {
    const urgentAnnouncement = mockAnnouncement({
      priority: 'urgent',
      title: 'Urgent Notice',
    });
    render(<AnnouncementsBanner announcements={[urgentAnnouncement]} />);

    const titleElement = screen.getByText('Urgent Notice');
    // The parent container should have the urgent class (bg-red-700)
    const container = titleElement.closest('[class*="bg-red-700"]');
    expect(container).toBeTruthy();
  });

  it('returns null when no announcements', () => {
    const { container } = render(<AnnouncementsBanner announcements={[]} />);
    expect(container.innerHTML).toBe('');
  });
});
