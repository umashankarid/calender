import { vi, describe, it, expect, afterEach, beforeEach } from 'vitest';

// ── Imports ──────────────────────────────────────────────────────────────────

import React from 'react';
import { render, screen } from '../../../test/test-utils';
import DisplayHeader from '../DisplayHeader';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DisplayHeader', () => {
  beforeEach(() => {
    // Mock Date to Friday, August 28, 2026 at 14:35
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 28, 14, 35, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders workspace name', () => {
    render(<DisplayHeader workspaceName="Acme Corp" />);
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it('renders current date', () => {
    render(<DisplayHeader workspaceName="Acme Corp" />);
    // Date format: FRIDAY 28 AUGUST
    expect(screen.getByText('FRIDAY 28 AUGUST')).toBeInTheDocument();
  });

  it('renders time', () => {
    render(<DisplayHeader workspaceName="Acme Corp" />);
    expect(screen.getByText('14:35')).toBeInTheDocument();
  });
});
