import type { GroupRead } from '../services/groups';

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

export const FALLBACK_GROUPS: GroupRead[] = [
  {
    id: 'demo-lowry-creatives',
    name: 'Lowry Late-Night Creators',
    description: 'Design jams and maker sessions after 9pm at Lowry Center.',
    created_at: daysAgo(3),
  },
  {
    id: 'demo-wooster-runners',
    name: 'Wooster Sunrise Runners',
    description: 'Casual 5K loops before 8 a.m. with coffee at Old Main.',
    created_at: daysAgo(5),
  },
  {
    id: 'demo-tabletop-society',
    name: 'Tabletop Society',
    description: 'Strategy board games every Friday in the student union.',
    created_at: daysAgo(7),
  },
  {
    id: 'demo-quad-yoga',
    name: 'Quad Flow & Chill',
    description: 'Outdoor yoga + mindfulness circles when the weather cooperates.',
    created_at: daysAgo(9),
  },
];
