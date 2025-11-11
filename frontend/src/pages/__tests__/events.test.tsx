import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Events from '../Events';
import { setupMockApi } from '../../mocks/mockApi';
import { ToastProvider } from '../../components/ToastProvider';

const mock = setupMockApi();

function renderEvents() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Events />
      </ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mock.resetHistory();
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
      expect(screen.getByText(/Karaoke Night/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Hack Night/i)).not.toBeInTheDocument();
  });
});
