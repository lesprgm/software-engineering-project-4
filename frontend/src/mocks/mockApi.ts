import MockAdapter from 'axios-mock-adapter';
import api from '../lib/api';

type User = { id: string; name: string; email: string; avatarUrl?: string; interests?: string[] };
type Event = {
  id: number;
  title: string;
  description?: string;
  location?: string;
  category?: string;
  start_time: string;
  end_time?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  image_url?: string;
  lat?: number;
  lng?: number;
};
type Place = { id: string; name: string; rating: number; tags?: string[]; description?: string; location?: string; latitude?: number; longitude?: number };
type Suggestion = { id: string; type?: 'user' | 'group'; name: string; avatarUrl?: string; interests?: string[]; insight?: string };
type Thread = { id: string; name: string; lastMessageAt?: string };
type Message = { id: string; threadId: string; senderId: string; senderName: string; content: string; createdAt: string };
type AvailabilitySlot = { day: number; hour: number };
type DateEvent = { id: string; partnerName: string; when: string; location?: string; status: 'proposed' | 'confirmed' };
type Match = { id: string; name: string; avatarUrl?: string; sharedInterests?: string[] };

type IdeaRecord = {
  id: number;
  match_id: string;
  title: string;
  description: string;
  location?: string | null;
  idea_rank: number;
  generated_at: string;
  expires_at: string;
};

const posterBase = `${import.meta.env.BASE_URL ?? '/'}events`;
const nowIso = () => new Date().toISOString();

function upcoming(hoursFromNow: number, durationHours: number) {
  const start = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  const end = new Date(start.getTime() + durationHours * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const db = {
  currentUser: { id: 'u1', name: 'Alex Student', email: 'alex@example.edu', interests: ['Music', 'Tech'], avatarUrl: '' } as User,
  users: [] as User[],
  events: [
    (() => {
      const { start, end } = upcoming(24, 4);
      return {
        id: 1,
        title: 'Hack Night',
        description: 'Bring your laptop and ideas for a casual coding jam.',
        location: 'CS Lab',
        category: 'tech',
        tags: ['tech', 'coding'],
        image_url: 'https://via.placeholder.com/800x400?text=Hack+Night',
        lat: 37.8715,
        lng: -122.273,
        start_time: start,
        end_time: end,
        created_at: nowIso(),
        updated_at: nowIso(),
      } satisfies Event;
    })(),
    (() => {
      const { start, end } = upcoming(48, 3);
      return {
        id: 2,
        title: 'Open Mic',
        description: 'Showcase your talent: music, poetry, comedy welcome.',
        location: 'Student Center',
        category: 'music',
        tags: ['music'],
        image_url: 'https://via.placeholder.com/800x400?text=Open+Mic',
        lat: 37.8721,
        lng: -122.269,
        start_time: start,
        end_time: end,
        created_at: nowIso(),
        updated_at: nowIso(),
      } satisfies Event;
    })(),
    (() => {
      const { start, end } = upcoming(72, 2);
      return {
        id: 3,
        title: 'Karaoke Night',
        description: 'Grab the mic and sing with friends.',
        location: 'The Underground',
        category: 'music',
        tags: ['music', 'karaoke'],
        image_url: `${posterBase}/karaoke.svg`,
        lat: 37.873,
        lng: -122.27,
        start_time: start,
        end_time: end,
        created_at: nowIso(),
        updated_at: nowIso(),
      } satisfies Event;
    })(),
    (() => {
      const { start, end } = upcoming(96, 3);
      return {
        id: 4,
        title: 'Ladies Night',
        description: 'Special deals and music all night.',
        location: 'Downtown Venue',
        category: 'social',
        tags: ['nightlife'],
        image_url: `${posterBase}/ladies-night.svg`,
        start_time: start,
        end_time: end,
        created_at: nowIso(),
        updated_at: nowIso(),
      } satisfies Event;
    })(),
  ] as Event[],
  places: [
    { id: 'p1', name: 'Campus Cafe', rating: 4.3, tags: ['coffee', 'quiet'], description: 'Cozy for study dates.', location: 'Student Center', latitude: 37.8715, longitude: -122.273 },
    { id: 'p2', name: 'Quad Lawn', rating: 4.7, tags: ['outdoors'], description: 'Great for picnics and frisbee.', location: 'Main Quad', latitude: 37.8719, longitude: -122.268 },
    { id: 'p3', name: 'Broken Rocks Cafe & Bakery', rating: 4.6, tags: ['restaurant', 'cafe', 'date-night'], description: 'Cozy brunch plates.', location: '123 E Liberty St, Wooster', latitude: 40.7989, longitude: -81.9376 },
    { id: 'p4', name: 'City Square Steakhouse', rating: 4.7, tags: ['restaurant', 'steakhouse', 'upscale'], description: 'Celebratory dinners.', location: '148 S Market St, Wooster', latitude: 40.7976, longitude: -81.9381 },
  ] as Place[],
  suggestions: [
    { id: 's1', type: 'user', name: 'Jamie', avatarUrl: 'https://via.placeholder.com/96?text=J', interests: ['Movies', 'Food'], insight: 'Both love sushi and weekend films.' },
    { id: 's2', type: 'user', name: 'Taylor', avatarUrl: 'https://via.placeholder.com/96?text=T', interests: ['Outdoors', 'Travel'], insight: 'Hiking spots overlap near campus.' },
    { id: 's3', type: 'group', name: 'Board Games Night', interests: ['Games', 'Pizza'], insight: 'You enjoy strategy games and casual meetups.' },
    { id: 's4', type: 'group', name: 'Study Group: CS201', interests: ['Tech', 'Study'], insight: 'Shared coursework and study times align.' },
  ] as Suggestion[],
  availability: [
    { day: 1, hour: 18 },
    { day: 3, hour: 19 },
    { day: 5, hour: 20 },
  ] as AvailabilitySlot[],
  upcomingDates: [
    { id: 'd1', partnerName: 'Jamie', when: upcoming(2, 1).start, location: 'Campus Cafe', status: 'confirmed' },
    { id: 'd2', partnerName: 'Taylor', when: upcoming(26, 1).start, status: 'proposed' },
  ] as DateEvent[],
  dateMatches: [
    { id: 'm1', name: 'Jamie', avatarUrl: 'https://via.placeholder.com/96?text=J', sharedInterests: ['Movies', 'Food'] },
    { id: 'm2', name: 'Taylor', avatarUrl: 'https://via.placeholder.com/96?text=T', sharedInterests: ['Outdoors', 'Travel'] },
  ] as Match[],
  inbox: [
    { id: 'p1', partnerName: 'Riley', when: upcoming(36, 1).start, location: 'Student Center', idea: 'Meet for boba then a walk across the quad.' },
  ] as { id: string; partnerName: string; when: string; location: string; idea: string }[],
};

const aiCache = {
  insights: new Map<string, { summary_text: string; generated_at: string }>(),
  ideas: new Map<string, { generated_at: string; ideas: IdeaRecord[] }>(),
};

const eventInterests = new Map<number, Set<string>>();

function serializeEvents(events: Event[], query: string) {
  const lowered = query.toLowerCase();
  const filtered = !query
    ? events
    : events.filter((event) => {
        const inTitle = event.title.toLowerCase().includes(lowered);
        const inLocation = (event.location || '').toLowerCase().includes(lowered);
        const inTags = (event.tags || []).some((tag) => tag.toLowerCase().includes(lowered));
        return inTitle || inLocation || inTags;
      });
  return filtered.map((event) => ({
    ...event,
    category: event.category ?? (event.tags?.[0] ?? 'social'),
  }));
}

export function setupMockApi() {
  const mock = new MockAdapter(api, { delayResponse: 250 });

  // Auth
  mock.onPost('/auth/login').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const user: User = { ...db.currentUser, email: body.email || db.currentUser.email };
      return [200, { access_token: 'mock-token', user }];
    } catch {
      return [200, { access_token: 'mock-token', user: db.currentUser }];
    }
  });

  mock.onPost('/auth/signup').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const newUser: User = {
        id: `u${Date.now()}`,
        name: body.name || 'New Student',
        email: body.email || 'student@example.edu',
        interests: Array.isArray(body.interests) ? body.interests : [],
      };
      db.currentUser = newUser;
      db.users.push(newUser);
      return [200, { access_token: 'mock-token', user: newUser }];
    } catch {
      return [400, { detail: 'Invalid signup data' }];
    }
  });

  // Profile
  mock.onGet('/users/me').reply(200, db.currentUser);
  mock.onPut('/users/me').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      db.currentUser = { ...db.currentUser, ...body };
      return [200, db.currentUser];
    } catch {
      return [400, { detail: 'Invalid profile data' }];
    }
  });
  mock.onPost('/users/me/avatar').reply(200, { url: 'https://via.placeholder.com/96?text=Avatar' });

  // Matches
  mock.onGet('/matches/suggestions').reply((config) => {
    const params = new URLSearchParams((config.params as Record<string, string | undefined>) || {});
    const type = params.get('type');
    if (type === 'group') return [200, db.suggestions.filter((entry) => entry.type === 'group')];
    if (type === 'user') return [200, db.suggestions.filter((entry) => entry.type !== 'group')];
    return [200, db.suggestions];
  });
  mock.onPost(/\/matches\/[^/]+\/accept$/).reply(200, { ok: true });
  mock.onPost(/\/matches\/[^/]+\/skip$/).reply(200, { ok: true });
  mock.onGet(/\/matches\/users\/([^/]+)$/).reply(() => {
    const candidates = db.suggestions
      .filter((suggestion) => suggestion.type === 'user')
      .map((suggestion, index) => ({
        user_id: suggestion.id,
        display_name: suggestion.name,
        compatibility_score: Math.max(0.95 - index * 0.05, 0.2),
        shared_interests: suggestion.interests || [],
        schedule_score: 0.5,
        personality_overlap: 0.4,
      }));
    return [200, { candidates }];
  });

  mock.onGet(/\/matches\/([^/]+)\/insight$/).reply((config) => {
    const match = config.url?.match(/\/matches\/([^/]+)\/insight$/);
    const matchId = match ? match[1] : '';
    const cached = matchId ? aiCache.insights.get(matchId) : null;
    if (!cached) {
      return [404, { detail: 'No insight cached' }];
    }
    return [200, { match_id: matchId, summary_text: cached.summary_text, generated_at: cached.generated_at, cached: true }];
  });

  mock.onPost(/\/matches\/([^/]+)\/insight$/).reply((config) => {
    try {
      const match = config.url?.match(/\/matches\/([^/]+)\/insight$/);
      const matchId = match ? match[1] : `match-${Date.now()}`;
      const body = JSON.parse(config.data || '{}');
      const shared = Array.isArray(body.shared_interests) && body.shared_interests.length
        ? body.shared_interests.join(', ')
        : 'campus life';
      const summary = `You both connect over ${shared}. Plan something near ${body.location || 'campus'}.`;
      const payload = { summary_text: summary, generated_at: new Date().toISOString() };
      aiCache.insights.set(matchId, payload);
      return [200, { match_id: matchId, summary_text: summary, generated_at: payload.generated_at, cached: false }];
    } catch {
      return [400, { detail: 'Unable to craft insight' }];
    }
  });

  // Events
  mock.onGet('/events').reply((config) => {
    const params = (config.params || {}) as Record<string, unknown>;
    const query = String(params.q ?? '').trim().toLowerCase();
    const upcomingFlag = String(params.upcoming ?? 'true');
    const now = Date.now();

    let items = db.events.slice();
    if (upcomingFlag !== 'false') {
      items = items.filter((event) => new Date(event.start_time).getTime() >= now);
    }
    if (query) {
      items = items.filter((event) => {
        const inTitle = event.title.toLowerCase().includes(query);
        const inLocation = (event.location || '').toLowerCase().includes(query);
        const inTags = (event.tags || []).some((tag) => tag.toLowerCase().includes(query));
        return inTitle || inLocation || inTags;
      });
    }
    return [200, items];
  });

  mock.onGet('/events/nlp-search').reply((config) => {
    const params = new URLSearchParams((config.params as Record<string, string | undefined>) || config.url?.split('?')[1] || '');
    const query = params.get('q') || '';
    const events = serializeEvents(db.events, query);
    const filters = {
      location: query || null,
      category: events[0]?.category ?? null,
      keywords: query ? [query.toLowerCase()] : [],
      date_range: query ? { start: events[0]?.start_time ?? null, end: events[0]?.end_time ?? null } : null,
    };
    return [200, {
      query,
      interpreted_query: query ? `Results for "${query}"` : 'All upcoming events',
      events,
      filters,
      cached: false,
      generated_at: new Date().toISOString(),
    }];
  });

  mock.onPost(/\/events\/[^/]+\/rsvp$/).reply(200, { ok: true });

  mock.onGet(/\/events\/\d+\/interests$/).reply((config) => {
    const match = config.url?.match(/\/events\/(\d+)\/interests$/);
    const eventId = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(eventId) || !db.events.some((event) => event.id === eventId)) {
      return [404, { detail: 'Event not found' }];
    }
    const bag = eventInterests.get(eventId) ?? new Set<string>();
    return [200, { event_id: eventId, interested_count: bag.size }];
  });

  mock.onPost(/\/events\/\d+\/interests$/).reply((config) => {
    const match = config.url?.match(/\/events\/(\d+)\/interests$/);
    const eventId = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(eventId) || !db.events.some((event) => event.id === eventId)) {
      return [404, { detail: 'Event not found' }];
    }
    try {
      const body = JSON.parse(config.data || '{}');
      const userId = String(body.user_id || '').trim();
      if (!userId) {
        return [400, { detail: 'user_id is required' }];
      }
      const bag = eventInterests.get(eventId) ?? new Set<string>();
      if (bag.has(userId)) {
        bag.delete(userId);
      } else {
        bag.add(userId);
      }
      eventInterests.set(eventId, bag);
      return [200, { event_id: eventId, interested_count: bag.size }];
    } catch {
      return [400, { detail: 'Invalid payload' }];
    }
  });

  // Places and AI helpers
  mock.onGet('/places').reply(200, db.places);
  mock.onGet('/places/top').reply((config) => {
    const params = new URLSearchParams((config.params as Record<string, string | undefined>) || {});
    const limit = Number(params.get('limit') || 5);
    const sorted = [...db.places].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return [200, sorted.slice(0, limit)];
  });
  mock.onGet('/ai/date-idea').reply((config) => {
    const placeId = new URLSearchParams((config.params as Record<string, string | undefined>) || {}).get('placeId') || '';
    const place = db.places.find((entry) => entry.id === placeId);
    return [200, { idea: place ? `Try a study date at ${place.name} with a latte tasting.` : 'Try a campus walk and coffee after.' }];
  });

  mock.onPost('/ideas').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const matchId = String(body.match_id || `match-${Date.now()}`);
      const shared: string[] = Array.isArray(body.shared_interests) ? body.shared_interests : [];
      const now = new Date().toISOString();
      const ideas: IdeaRecord[] = [0, 1, 2].map((index) => {
        const interest = shared[index % (shared.length || 1)] || 'campus life';
        const spot = ['Campus Cafe', 'Student Center', 'Quad Lawn'][index] || 'Campus Cafe';
        return {
          id: Date.now() + index,
          match_id: matchId,
          title: index === 0 ? `Coffee chat about ${interest}` : index === 1 ? `Explore ${interest}` : `Relax with ${interest}`,
          description: `Enjoy ${interest} together at the ${spot}.`,
          location: spot,
          idea_rank: index,
          generated_at: now,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
      });
      aiCache.ideas.set(matchId, { generated_at: now, ideas });
      return [200, { match_id: matchId, ideas, cached: false, generated_at: now }];
    } catch {
      return [400, { detail: 'Invalid idea request' }];
    }
  });

  mock.onGet('/ideas').reply((config) => {
    const params = new URLSearchParams((config.params as Record<string, string | undefined>) || config.url?.split('?')[1] || '');
    const matchId = params.get('match_id') || 'mock';
    const cached = aiCache.ideas.get(matchId);
    if (!cached) {
      return [404, { detail: 'No cached ideas' }];
    }
    return [200, { match_id: matchId, ideas: cached.ideas, cached: true, generated_at: cached.generated_at }];
  });

  // Messaging
  const messages: Message[] = [];
  const threads: Thread[] = [{ id: 't1', name: 'Jamie', lastMessageAt: new Date().toISOString() }];

  mock.onGet('/messages/threads').reply(200, threads);
  mock.onGet(/\/messages\/([^/]+)$/).reply((config) => {
    const match = config.url?.match(/\/messages\/(.+)$/);
    const threadId = match ? match[1] : '';
    const list = messages.filter((message) => message.threadId === threadId);
    return [200, { messages: list }];
  });
  mock.onPost(/\/messages\/([^/]+)$/).reply((config) => {
    try {
      const match = config.url?.match(/\/messages\/(.+)$/);
      const threadId = match ? match[1] : '';
      const body = JSON.parse(config.data || '{}');
      const message: Message = {
        id: `m${Date.now()}`,
        threadId,
        senderId: db.currentUser.id,
        senderName: db.currentUser.name,
        content: String(body.content || ''),
        createdAt: new Date().toISOString(),
      };
      messages.push(message);
      const thread = threads.find((entry) => entry.id === threadId);
      if (thread) {
        thread.lastMessageAt = message.createdAt;
      }
      return [200, message];
    } catch {
      return [400, { detail: 'Invalid message' }];
    }
  });

  // Dates
  mock.onGet('/dates/availability').reply(200, db.availability);
  mock.onPut('/dates/availability').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      db.availability = Array.isArray(body.slots) ? body.slots : db.availability;
      return [200, { ok: true }];
    } catch {
      return [400, { detail: 'Invalid availability' }];
    }
  });
  mock.onGet('/dates/upcoming').reply(200, db.upcomingDates);
  mock.onGet('/dates/matches').reply(200, db.dateMatches);
  mock.onPost('/dates/options').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const matchId = String(body.matchId || '');
      const person = db.dateMatches.find((entry) => entry.id === matchId);
      const base = Date.now() + 48 * 3600 * 1000;
      const options = [0, 1].map((index) => {
        const when = new Date(base + index * 24 * 3600 * 1000).toISOString();
        const shared = person?.sharedInterests ?? [];
        const interest = shared[index % (shared.length || 1)] || 'campus life';
        const location = index === 0 ? 'Campus Cafe' : 'Student Center';
        return {
          partnerName: person?.name || 'Your match',
          when,
          location,
          idea: `Enjoy ${interest} together at the ${location.toLowerCase()}.`,
          reasons: shared.slice(0, 2),
        };
      });
      return [200, { partnerName: person?.name || 'Your match', options }];
    } catch {
      return [200, {
        partnerName: 'Your match',
        options: [
          { partnerName: 'Your match', when: new Date().toISOString(), location: 'Campus Cafe', idea: 'Coffee and a walk.', reasons: ['Coffee', 'Casual chat'] },
          { partnerName: 'Your match', when: new Date(Date.now() + 86400000).toISOString(), location: 'Student Center', idea: 'Arcade and snacks.', reasons: ['Games', 'Indoor'] },
        ],
      }];
    }
  });

  mock.onPost('/dates/propose').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const plan = body.plan || {};
      const id = `d${Date.now()}`;
      db.upcomingDates.unshift({
        id,
        partnerName: plan.partnerName || 'Match',
        when: plan.when || new Date().toISOString(),
        location: plan.location || 'TBD',
        status: 'proposed',
      });
      return [200, { ok: true }];
    } catch {
      return [200, { ok: true }];
    }
  });

  mock.onGet('/dates/inbox').reply(200, db.inbox);
  mock.onPost('/dates/accept').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const id = String(body.proposalId || '');
      const when = String(body.when || new Date().toISOString());
      const index = db.inbox.findIndex((entry) => entry.id === id);
      const proposal = index >= 0
        ? db.inbox.splice(index, 1)[0]
        : { id: id || `p${Date.now()}`, partnerName: 'Match', when, location: 'TBD', idea: '' };
      db.upcomingDates.unshift({
        id: `d${Date.now()}`,
        partnerName: proposal.partnerName,
        when,
        location: proposal.location,
        status: 'confirmed',
      });
      return [200, { ok: true }];
    } catch {
      return [200, { ok: true }];
    }
  });

  return mock;
}
