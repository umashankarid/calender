import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '../../../test/test-utils';
import userEvent from '@testing-library/user-event';
import BottomNav from '../BottomNav';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BottomNav', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 4 tabs', () => {
    render(<BottomNav active="today" onChange={onChange} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('clicking tab calls onChange with correct key', async () => {
    const user = userEvent.setup();
    render(<BottomNav active="today" onChange={onChange} />);

    await user.click(screen.getByText('Calendar'));
    expect(onChange).toHaveBeenCalledWith('calendar');

    await user.click(screen.getByText('Tasks'));
    expect(onChange).toHaveBeenCalledWith('tasks');

    await user.click(screen.getByText('More'));
    expect(onChange).toHaveBeenCalledWith('more');
  });

  it('active tab has highlighted style', () => {
    render(<BottomNav active="calendar" onChange={onChange} />);

    // Active tab should have aria-current="page"
    const calendarButton = screen.getByText('Calendar').closest('button')!;
    expect(calendarButton).toHaveAttribute('aria-current', 'page');

    // Inactive tabs should not
    const todayButton = screen.getByText('Today').closest('button')!;
    expect(todayButton).not.toHaveAttribute('aria-current');
  });
});
