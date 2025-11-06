import MockAdapter from 'axios-mock-adapter';
import api from '../lib/api';

type User = { id: string; name: string; email: string; avatarUrl?: string; interests?: string[] };
type Event = { id: string; title: string; date: string; location: string; tags?: string[]; imageUrl?: string; lat?: number; lng?: number; description?: string };
type Place = { id: string; name: string; rating: number; tags?: string[]; description?: string };
type Suggestion = { id: string; name: string; avatarUrl?: string; interests?: string[]; insight?: string };
type Thread = { id: string; name: string; lastMessageAt?: string };
type Message = { id: string; threadId: string; senderId: string; senderName: string; content: string; createdAt: string };
type AvailabilitySlot = { day: number; hour: number };
type DateEvent = { id: string; partnerName: string; when: string; location?: string; status: 'proposed' | 'confirmed' };
type Match = { id: string; name: string; avatarUrl?: string; sharedInterests?: string[] };

const db = {
  currentUser: { id: 'u1', name: 'Alex Student', email: 'alex@example.edu', interests: ['Music', 'Tech'], avatarUrl: '' } as User,
  users: [] as User[],
  events: [
    { id: 'e1', title: 'Hack Night', date: new Date(Date.now() + 86400000).toISOString(), location: 'CS Lab', tags: ['tech', 'coding'], imageUrl: 'https://via.placeholder.com/800x400?text=Hack+Night', lat: 37.8715, lng: -122.2730, description: 'Bring your laptop and ideas for a casual coding jam.' },
    { id: 'e2', title: 'Open Mic', date: new Date(Date.now() + 2*86400000).toISOString(), location: 'Student Center', tags: ['music'], imageUrl: 'https://via.placeholder.com/800x400?text=Open+Mic', lat: 37.8721, lng: -122.2690, description: 'Showcase your talent: music, poetry, comedy welcome.' },
  ] as Event[],
  places: [
    { id: 'p1', name: 'Campus Cafe', rating: 4.3, tags: ['coffee', 'quiet'], description: 'Cozy for study dates.' },
    { id: 'p2', name: 'Quad Lawn', rating: 4.7, tags: ['outdoors'], description: 'Great for picnics and frisbee.' },
  ] as Place[],
  suggestions: [
    // One-to-one fake profiles
    { id: 's1', type: 'user', name: 'Jamie', avatarUrl: 'https://via.placeholder.com/96?text=J', interests: ['Movies', 'Food'], insight: 'Both love sushi and weekend films.' },
    { id: 's2', type: 'user', name: 'Taylor', avatarUrl: 'https://via.placeholder.com/96?text=T', interests: ['Outdoors', 'Travel'], insight: 'Hiking spots overlap near campus.' },
    { id: 's5', type: 'user', name: 'Alex', avatarUrl: 'https://via.placeholder.com/96?text=A', interests: ['Tech', 'Music'], insight: 'Both attend hack nights and indie gigs.' },
    { id: 's6', type: 'user', name: 'Brianna', avatarUrl: 'https://via.placeholder.com/96?text=B', interests: ['Art', 'Coffee'], insight: 'Sketching sessions at the campus cafe sound perfect.' },
    { id: 's7', type: 'user', name: 'Chris', avatarUrl: 'https://via.placeholder.com/96?text=C', interests: ['Basketball', 'Gaming'], insight: 'Pick-up games and cozy co-op nights match well.' },
    { id: 's8', type: 'user', name: 'Dana', avatarUrl: 'https://via.placeholder.com/96?text=D', interests: ['Books', 'Movies'], insight: 'Film club and book swaps are shared favorites.' },
    { id: 's9', type: 'user', name: 'Evan', avatarUrl: 'https://via.placeholder.com/96?text=E', interests: ['Outdoors', 'Photography'], insight: 'Golden-hour photo walks around campus.' },
    { id: 's10', type: 'user', name: 'Fatima', avatarUrl: 'https://via.placeholder.com/96?text=F', interests: ['Cooking', 'Volunteering'], insight: 'Community kitchen nights and recipe exchanges.' },
    { id: 's11', type: 'user', name: 'Gabe', avatarUrl: 'https://via.placeholder.com/96?text=G', interests: ['Climbing', 'Travel'], insight: 'Bouldering sessions and planning weekend trips.' },
    { id: 's12', type: 'user', name: 'Hana', avatarUrl: 'https://via.placeholder.com/96?text=H', interests: ['K-pop', 'Dance'], insight: 'Dance practice and music video nights.' },
    { id: 's13', type: 'user', name: 'Ishan', avatarUrl: 'https://via.placeholder.com/96?text=I', interests: ['Cricket', 'Tech'], insight: 'Cricket scrimmages and building side projects.' },
    { id: 's14', type: 'user', name: 'Jade', avatarUrl: 'https://via.placeholder.com/96?text=Jd', interests: ['Yoga', 'Food'], insight: 'Morning yoga followed by brunch experiments.' },
    // Group examples
    { id: 's3', type: 'group', name: 'Board Games Night', interests: ['Games', 'Pizza'], insight: 'You enjoy strategy games and casual meetups.' },
    { id: 's4', type: 'group', name: 'Study Group: CS201', interests: ['Tech', 'Study'], insight: 'Shared coursework and study times align.' },
  ] as Suggestion[],
  availability: [
    { day: 1, hour: 18 },
    { day: 3, hour: 19 },
    { day: 5, hour: 20 },
  ] as AvailabilitySlot[],
  upcomingDates: [
    { id: 'd1', partnerName: 'Jamie', when: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), location: 'Campus Cafe', status: 'confirmed' },
    { id: 'd2', partnerName: 'Taylor', when: new Date(Date.now() + 26 * 3600 * 1000).toISOString(), status: 'proposed' },
  ] as DateEvent[],
  dateMatches: [
    { id: 'm1', name: 'Jamie', avatarUrl: 'https://via.placeholder.com/96?text=J', sharedInterests: ['Movies', 'Food'] },
    { id: 'm2', name: 'Taylor', avatarUrl: 'https://via.placeholder.com/96?text=T', sharedInterests: ['Outdoors', 'Travel'] },
  ] as Match[],
  inbox: [
    { id: 'p1', partnerName: 'Riley', when: new Date(Date.now() + 36 * 3600 * 1000).toISOString(), location: 'Student Center', idea: 'Meet for boba then a walk across the quad.' },
  ] as { id: string; partnerName: string; when: string; location: string; idea: string }[],
};

export function setupMockApi() {
  const mock = new MockAdapter(api, { delayResponse: 250 });

  // Auth
  mock.onPost('/auth/login').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const user: User = { ...db.currentUser, email: body.email || db.currentUser.email };
      return [200, { access_token: 'mock-token', user }];
    } catch { return [200, { access_token: 'mock-token', user: db.currentUser }]; }
  });

  mock.onPost('/auth/signup').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const newUser: User = { id: `u${Date.now()}`, name: body.name || 'New Student', email: body.email || 'student@example.edu', interests: [] };
      db.currentUser = newUser;
      db.users.push(newUser);
      return [200, { access_token: 'mock-token', user: newUser }];
    } catch { return [400, { detail: 'Invalid signup data' }]; }
  });

  // Profile
  mock.onGet('/users/me').reply(200, db.currentUser);
  mock.onPut('/users/me').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      db.currentUser = { ...db.currentUser, ...body };
      return [200, db.currentUser];
    } catch { return [400, { detail: 'Invalid profile data' }]; }
  });
  mock.onPost('/users/me/avatar').reply(200, { url: 'https://via.placeholder.com/96?text=Avatar' });

  // Matches
  mock.onGet('/matches/suggestions').reply((config) => {
    const type = new URLSearchParams((config.params as any) || {}).get('type');
    if (type === 'group') return [200, db.suggestions.filter(s => s.type === 'group')];
    if (type === 'user') return [200, db.suggestions.filter(s => s.type !== 'group')];
    return [200, db.suggestions];
  });
  mock.onPost(/\/matches\/[^/]+\/accept$/).reply(200, { ok: true });
  mock.onPost(/\/matches\/[^/]+\/skip$/).reply(200, { ok: true });

  // Events
  mock.onGet('/events').reply((config) => {
    const url = new URL(config.baseURL?.startsWith('http') ? config.baseURL : 'http://x');
    const q = new URLSearchParams((config.params as any) || {}).get('q') || '';
    const items = db.events.filter(e => e.title.toLowerCase().includes(q.toLowerCase()) || e.tags?.some(t => t.includes(q.toLowerCase())));
    return [200, items];
  });
  mock.onPost(/\/events\/[^/]+\/rsvp$/).reply(200, { ok: true });

  // Places + AI idea
  mock.onGet('/places').reply(200, db.places);
  mock.onGet('/ai/date-idea').reply((config) => {
    const placeId = new URLSearchParams((config.params as any) || {}).get('placeId') || '';
    const place = db.places.find(p => p.id === placeId);
    return [200, { idea: place ? `Try a study date at ${place.name} with a latte tasting.` : 'Try a campus walk and coffee after.' }];
  });

  // Messaging
  const messages: Message[] = [];
  const threads: Thread[] = [
    { id: 't1', name: 'Jamie', lastMessageAt: new Date().toISOString() },
  ];

  mock.onGet('/messages/threads').reply(200, threads);
  mock.onGet(/\/messages\/([^/]+)$/).reply((config) => {
    const m = config.url?.match(/\/messages\/(.+)$/);
    const threadId = m ? m[1] : '';
    const list = messages.filter(msg => msg.threadId === threadId);
    return [200, { messages: list }];
  });
  mock.onPost(/\/messages\/([^/]+)$/).reply((config) => {
    try {
      const m = config.url?.match(/\/messages\/(.+)$/);
      const threadId = m ? m[1] : '';
      const body = JSON.parse(config.data || '{}');
      const msg: Message = {
        id: `m${Date.now()}`,
        threadId,
        senderId: db.currentUser.id,
        senderName: db.currentUser.name,
        content: String(body.content || ''),
        createdAt: new Date().toISOString(),
      };
      messages.push(msg);
      const t = threads.find(x => x.id === threadId);
      if (t) t.lastMessageAt = msg.createdAt;
      return [200, msg];
    } catch { return [400, { detail: 'Invalid message' }]; }
  });

  // Dates (availability + upcoming)
  mock.onGet('/dates/availability').reply(200, db.availability);
  mock.onPut('/dates/availability').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      db.availability = Array.isArray(body.slots) ? body.slots : db.availability;
      return [200, { ok: true }];
    } catch { return [400, { detail: 'Invalid availability' }]; }
  });
  mock.onGet('/dates/upcoming').reply(200, db.upcomingDates);
  mock.onGet('/dates/matches').reply(200, db.dateMatches);
  mock.onPost('/dates/options').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const id = String(body.matchId || '');
      const person = db.dateMatches.find((x) => x.id === id);
      const base = Date.now() + 48 * 3600 * 1000;
      const optA = {
        partnerName: person?.name || 'Your match',
        when: new Date(base).toISOString(),
        location: person?.sharedInterests?.includes('Food') ? 'Campus Cafe' : 'Quad Lawn',
        idea: person ? `Grab ${person.sharedInterests?.includes('Food') ? 'a latte' : 'some fresh air'} and talk about ${(person.sharedInterests || []).slice(0,2).join(' & ') || 'campus life'}.` : 'Coffee + campus walk.',
        reasons: (person?.sharedInterests || []).slice(0,2),
      };
      const optB = {
        partnerName: person?.name || 'Your match',
        when: new Date(base + 24 * 3600 * 1000).toISOString(),
        location: person?.sharedInterests?.includes('Movies') ? 'Film Club Screening' : 'Student Center',
        idea: person ? `Meet at ${person.sharedInterests?.includes('Movies') ? 'a screening' : 'the student center'} then ${
          person.sharedInterests?.includes('Food') ? 'try a new snack spot' : 'walk the quad'
        }.` : 'Meet at the student center and explore.',
        reasons: (person?.sharedInterests || []).slice(0,2),
      };
      return [200, { partnerName: person?.name || 'Your match', options: [optA, optB] }];
    } catch { return [200, { partnerName: 'Your match', options: [
      { partnerName: 'Your match', when: new Date().toISOString(), location: 'Campus Cafe', idea: 'Coffee and a walk.', reasons: ['Coffee', 'Casual chat'] },
      { partnerName: 'Your match', when: new Date(Date.now()+86400000).toISOString(), location: 'Student Center', idea: 'Arcade and snacks.', reasons: ['Games', 'Indoor'] }
    ] }]; }
  });
  mock.onPost('/dates/propose').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const plan = body.plan || {};
      const id = `d${Date.now()}`;
      db.upcomingDates.unshift({ id, partnerName: plan.partnerName || 'Match', when: plan.when || new Date().toISOString(), location: plan.location || 'TBD', status: 'proposed' });
      return [200, { ok: true }];
    } catch { return [200, { ok: true }]; }
  });
  mock.onGet('/dates/inbox').reply(200, db.inbox);
  mock.onPost('/dates/accept').reply((config) => {
    try {
      const body = JSON.parse(config.data || '{}');
      const id = String(body.proposalId || '');
      const when = String(body.when || new Date().toISOString());
      const i = db.inbox.findIndex((x) => x.id === id);
      const proposal = i >= 0 ? db.inbox.splice(i, 1)[0] : { id: id || `p${Date.now()}`, partnerName: 'Match', when, location: 'TBD', idea: '' };
      db.upcomingDates.unshift({ id: `d${Date.now()}`, partnerName: proposal.partnerName, when, location: proposal.location, status: 'confirmed' });
      return [200, { ok: true }];
    } catch { return [200, { ok: true }]; }
  });

  // (Groups removed in this build)

  return mock;
}
