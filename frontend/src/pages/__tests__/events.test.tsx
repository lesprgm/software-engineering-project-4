import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { MemoryRouter } from 'react-router-dom';
import Events from '../Events';
import { ToastProvider } from '../../components/ToastProvider';
import api from '../../lib/api';

const mock = new MockAdapter(api);

const baseEvents = [
  {
    id: 1,
    title: 'Hack Night',
    location: 'CS Lab',
    category: 'tech',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    tags: ['tech'],
    interest_count: 4,
    viewer_interest: false,
  },
  {
    id: 2,
    title: 'Open Mic',
    location: 'Student Center',
    category: 'music',
    start_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    end_time: new Date(Date.now() + 25 * 3600 * 1000).toISOString(),
    tags: ['music'],
    interest_count: 7,
    viewer_interest: false,
  },
];

const karaokeEvent = {
  id: 99,
  title: 'Karaoke Night',
  location: 'Underground',
  category: 'music',
  start_time: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  end_time: new Date(Date.now() + 49 * 3600 * 1000).toISOString(),
  tags: ['music'],
  interest_count: 2,
  viewer_interest: false,
};

function seedApiMocks() {
  mock.onGet('/events').reply(200, baseEvents);
  mock.onGet('/events/nlp-search').reply(200, {
    query: 'karaoke',
    filters: null,
    events: [karaokeEvent],
    cached: false,
    interpreted_query: 'karaoke night',
    generated_at: new Date().toISOString(),
  });
}

function renderEvents() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ToastProvider>
          <Events />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mock.reset();
  seedApiMocks();
});

describe('Events page', () => {
  it('renders upcoming events returned by the API', async () => {
    renderEvents();

    expect(await screen.findByText(/Hack Night/i)).toBeInTheDocument();
    expect(screen.getByText(/Open Mic/i)).toBeInTheDocument();
  });

  it('filters events by search query', async () => {
    renderEvents();

    const searchBox = await screen.findByLabelText(/search events/i);
    await userEvent.clear(searchBox);
    await userEvent.type(searchBox, 'karaoke');

    await waitFor(() => {
      expect(screen.getAllByText(/Karaoke Night/i).length).toBeGreaterThan(0);
    });

    expect(screen.queryByText(/Hack Night/i)).not.toBeInTheDocument();
  });
});
