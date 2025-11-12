import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Avatar from '../components/ui/Avatar';
import { useToast } from '../components/ToastProvider';
import { downloadCalendarFile } from '../lib/calendar';
import { useAuthStore, User as AuthUser } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { aiApi, DateIdeaRequest, DateIdeasResponse, ParticipantProfile } from '../services/ai';
import { useUserMatches } from '../hooks/useGroups';
import { useViewNavigate } from '../hooks/useViewNavigate';
import { useBreadcrumb } from '../hooks/useBreadcrumb';

type Match = { id: string; name: string; avatarUrl?: string; sharedInterests?: string[] };
type Plan = { partnerName: string; when: string; location: string; idea: string };
type SavedPlan = Plan & { id: string };
type PlanOption = Plan & { reasons?: string[]; budget?: number; category?: string };
type PlanOptions = {
  partnerName: string;
  matchId?: string;
  options: PlanOption[];
  generatedAt?: string;
  cached?: boolean;
  match?: Match;
};

const BUDGET_LABELS = ['Free', '$', '$$', '$$$'] as const;

export default function Dates() {
  const [openOptions, setOpenOptions] = useState<PlanOptions | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [budgetTier, setBudgetTier] = useState(2);
  const [customOpen, setCustomOpen] = useState(false);
  const [customWhen, setCustomWhen] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customIdea, setCustomIdea] = useState('');
  const carouselRef = useRef<HTMLDivElement | null>(null);

  const { notify } = useToast();
  const navigate = useViewNavigate();
  useBreadcrumb('Dates', { parent: '/' });
  const currentUser = useAuthStore((state) => state.user);
  const { addNotification } = useNotifications();

  const { data: matchCandidates, isLoading: matchesLoading } = useUserMatches(currentUser?.id);
  const matches = useMemo<Match[]>(() => {
    if (!matchCandidates) return [];
    return matchCandidates.map((candidate) => ({
      id: candidate.user_id,
      name: candidate.display_name,
      sharedInterests: candidate.shared_interests,
    }));
  }, [matchCandidates]);

  const optionsMut = useMutation({
    mutationFn: async (match: Match) => {
      const payload = buildDateIdeaRequest(match, currentUser);
      const response = await aiApi.generateDateIdeas(payload);
      return { response: response.data, match };
    },
    onSuccess: ({ response, match }) => {
      setCustomOpen(false);
      setBudgetTier(2);
      setCarouselIndex(0);
      setOpenOptions(mapIdeasToPlanOptions(match, response));
    },
    onError: () => notify('Could not generate ideas right now. Try again later.', 'error'),
  });

  const filteredOptions = useMemo(() => {
    if (!openOptions) return [];
    return openOptions.options.filter((option) => (option.budget ?? 3) <= budgetTier);
  }, [openOptions, budgetTier]);
  const displayOptions = filteredOptions.length ? filteredOptions : openOptions?.options ?? [];
  const currentOption = displayOptions[carouselIndex] ?? null;

  useEffect(() => {
    setCarouselIndex(0);
  }, [openOptions?.matchId]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [budgetTier]);

  useEffect(() => {
    if (carouselIndex >= displayOptions.length) {
      setCarouselIndex(displayOptions.length ? displayOptions.length - 1 : 0);
    }
  }, [carouselIndex, displayOptions.length]);

  useEffect(() => {
    if (!openOptions) return;
    const node = carouselRef.current;
    if (!node) return;
    let raf: number | null = null;
    const handleScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        const width = node.clientWidth;
        if (width) {
          const idx = Math.round(node.scrollLeft / width);
          setCarouselIndex((prev) => (idx === prev ? prev : idx));
        }
        raf = null;
      });
    };
    node.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', handleScroll);
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = null;
      }
    };
  }, [openOptions, displayOptions.length]);

  const scrollCarousel = (direction: 'prev' | 'next') => {
    if (!carouselRef.current || !displayOptions.length) return;
    const width = carouselRef.current.clientWidth;
    if (!width) return;
    const nextIndex =
      direction === 'next'
        ? Math.min(displayOptions.length - 1, carouselIndex + 1)
        : Math.max(0, carouselIndex - 1);
    carouselRef.current.scrollTo({ left: width * nextIndex, behavior: 'smooth' });
    setCarouselIndex(nextIndex);
  };

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

  const handlePlanSelection = (plan: Plan) => {
    const saved: SavedPlan = { ...plan, id: `${plan.partnerName}-${Date.now()}` };
    setSavedPlans((prev) => [saved, ...prev]);
    notify(`Plan saved! Share it with ${plan.partnerName} to confirm.`, 'success');
    addNotification({
      kind: 'event',
      title: 'Plan saved',
      body: `Invite ${plan.partnerName} when you're ready.`,
    });
    setOpenOptions(null);
    setCustomOpen(false);
    setCustomIdea('');
    setCustomLocation('');
    setCustomWhen('');
  };

  const handleRemovePlan = (id: string) => {
    setSavedPlans((prev) => prev.filter((plan) => plan.id !== id));
    notify('Plan removed.', 'success');
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your matches</h2>
          <Button variant="secondary" onClick={() => navigate('/matches')}>Visit matches</Button>
        </div>
        {matchesLoading && (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="flex items-center gap-4 p-3 animate-pulse">
                <div className="h-14 w-14 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
                <div className="h-8 w-24 rounded-full bg-gray-200" />
              </Card>
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          {matches.map((match) => (
            <div key={match.id} className="flex items-center gap-4 p-2 sm:p-3">
              <Avatar src={match.avatarUrl || ''} name={match.name} className="w-14 h-14 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{match.name}</div>
                {!!match.sharedInterests?.length && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {match.sharedInterests.slice(0, 4).map((interest) => (
                      <span key={interest} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {interest}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => optionsMut.mutate(match)} loading={optionsMut.isPending}>
                {match.sharedInterests?.[0]
                  ? `Plan something around ${match.sharedInterests[0]}`
                  : `Plan with ${match.name.split(' ')[0] || 'match'}`}
              </Button>
            </div>
          ))}
        </div>
        {!matches.length && !matchesLoading && (
          <div className="text-center text-gray-500 mt-6">No matches yet. Find someone in the Matches tab!</div>
        )}
      </Card>

      {optionsMut.isPending && (
        <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
          Crafting date ideas… pulling in shared interests, vibe, and your budget preference.
        </div>
      )}

      {savedPlans.length > 0 && (
        <Card className="p-6">
          <div className="text-lg font-semibold mb-3">Saved plans</div>
          <div className="space-y-4">
            {savedPlans.map((plan) => (
              <div key={plan.id} className="rounded-lg border border-gray-200 p-3">
                <div className="font-medium text-gray-800">{plan.partnerName}</div>
                <div className="text-sm text-gray-600">{new Date(plan.when).toLocaleString()}</div>
                <div className="text-sm text-gray-600 mb-2">{plan.location}</div>
                <p className="text-sm text-gray-700">{plan.idea}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => navigate(`/messages?with=${encodeURIComponent(plan.partnerName)}`)}
                    variant="primary"
                  >
                    Message
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      downloadCalendarFile({
                        title: `Plan with ${plan.partnerName}`,
                        start: plan.when,
                        end: new Date(new Date(plan.when).getTime() + 60 * 60 * 1000).toISOString(),
                        location: plan.location,
                        description: plan.idea,
                        fileName: `${plan.partnerName}-plan`,
                      })
                    }
                  >
                    Add to calendar
                  </Button>
                  <Button variant="secondary" onClick={() => handleRemovePlan(plan.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!openOptions} onClose={() => setOpenOptions(null)} title={openOptions ? `Ideas with ${openOptions.partnerName}` : ''}>
        {openOptions && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Based on your shared interests, here are a few lightweight ideas. Save one or tweak it.
            </p>
            {openOptions.generatedAt && (
              <p className="text-xs text-slate-400">
                Generated {new Date(openOptions.generatedAt).toLocaleString()}
                {openOptions.cached ? ' (cached)' : ''}
              </p>
            )}

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400" htmlFor="budget-tier-slider">
                Budget
              </label>
              <input
                type="range"
                min={0}
                max={BUDGET_LABELS.length - 1}
                value={budgetTier}
                onChange={(event) => setBudgetTier(Number(event.target.value))}
                className="w-full accent-slate-900"
                id="budget-tier-slider"
                aria-valuemin={0}
                aria-valuemax={BUDGET_LABELS.length - 1}
                aria-valuenow={budgetTier}
                aria-label="Budget preference"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                {BUDGET_LABELS.map((label, idx) => (
                  <span key={label} className={clsx(idx === budgetTier && 'text-slate-900 font-medium')}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar"
              >
                {displayOptions.map((option, idx) => (
                  <div
                    key={`${option.location}-${idx}`}
                    className={clsx(
                      'min-w-full snap-center transition-all duration-200',
                      idx === carouselIndex ? 'opacity-100' : 'opacity-60'
                    )}
                  >
                    <div className="h-full rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="text-xs uppercase tracking-wide text-slate-400">{option.category || 'Idea'}</div>
                      <div className="flex flex-wrap items-center gap-2 text-slate-900">
                        <span className="text-lg font-medium">{option.location}</span>
                        <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs">
                          {BUDGET_LABELS[option.budget ?? 2]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{new Date(option.when).toLocaleString()}</p>
                      <p className="text-sm text-slate-700">{option.idea}</p>
                      {!!option.reasons?.length && (
                        <div className="flex flex-wrap gap-1 text-[11px] text-slate-500">
                          {option.reasons.map((reason, reasonIdx) => (
                            <span key={`${reason}-${reasonIdx}`} className="rounded-full border border-slate-200 px-2 py-0.5">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <Button
                          variant="ghost"
                          onClick={(event) => {
                            event.preventDefault();
                            navigate(`/messages?with=${encodeURIComponent(openOptions.partnerName)}`);
                          }}
                        >
                          Message
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={(event) => {
                            event.preventDefault();
                            downloadCalendarFile({
                              title: `Plan with ${openOptions.partnerName}`,
                              start: option.when,
                              end: new Date(new Date(option.when).getTime() + 60 * 60 * 1000).toISOString(),
                              location: option.location,
                              description: option.idea,
                              fileName: `${openOptions.partnerName}-idea`,
                            });
                          }}
                        >
                          Calendar
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={(event) => {
                            event.preventDefault();
                            navigator.clipboard.writeText(`${openOptions.partnerName} · ${option.location} · ${option.idea}`);
                            notify('Plan copied to clipboard', 'success');
                          }}
                        >
                          Share
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {!displayOptions.length && (
                  <div className="min-w-full">
                    <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">
                      No ideas match this budget yet. Slide up to explore more options.
                    </div>
                  </div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 -bottom-3 flex justify-center text-[10px] text-slate-400">
                {displayOptions.length ? `${carouselIndex + 1} / ${displayOptions.length}` : null}
              </div>
              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  type="button"
                  onClick={() => scrollCarousel('prev')}
                  disabled={carouselIndex === 0}
                  className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 disabled:opacity-30"
                >
                  <span aria-hidden="true">←</span>
                  <span className="sr-only">Previous idea</span>
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  type="button"
                  onClick={() => scrollCarousel('next')}
                  disabled={carouselIndex >= displayOptions.length - 1}
                  className="rounded-full border border-slate-200 bg-white/80 p-2 text-slate-600 disabled:opacity-30"
                >
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">Next idea</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => currentOption && handlePlanSelection(currentOption)} disabled={!currentOption}>
                Save this plan
              </Button>
              <Button variant="secondary" onClick={() => setCustomOpen((value) => !value)}>
                Suggest something else
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (openOptions?.match && !optionsMut.isPending) {
                    optionsMut.mutate(openOptions.match);
                  }
                }}
                loading={optionsMut.isPending}
                disabled={!openOptions?.match}
              >
                Not feeling it? Refresh ideas
              </Button>
            </div>

            {customOpen && (
              <div className="border-t border-slate-200 pt-3 space-y-2 text-sm">
                <div className="grid md:grid-cols-2 gap-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-500">When</span>
                    <input
                      type="datetime-local"
                      value={customWhen}
                      onChange={(event) => setCustomWhen(event.target.value)}
                      className="w-full rounded-md border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-slate-500">Where</span>
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(event) => setCustomLocation(event.target.value)}
                      placeholder="Location"
                      className="w-full rounded-md border border-slate-200 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="text-sm block">
                  <span className="mb-1 block text-slate-500">Plan details</span>
                  <textarea
                    rows={3}
                    value={customIdea}
                    onChange={(event) => setCustomIdea(event.target.value)}
                    placeholder="What should we do?"
                    className="w-full rounded-md border border-slate-200 px-3 py-2"
                  />
                </label>
                <div>
                  <Button
                    onClick={() => {
                      if (!customWhen || !customLocation) return;
                      const plan: Plan = {
                        partnerName: openOptions.partnerName,
                        when: new Date(customWhen).toISOString(),
                        location: customLocation,
                        idea: customIdea || 'Fun hangout',
                      };
                      handlePlanSelection(plan);
                    }}
                  >
                    Save custom proposal
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function buildDateIdeaRequest(match: Match, user?: AuthUser | null): DateIdeaRequest {
  const participants: ParticipantProfile[] = [];
  if (user) {
    participants.push({
      name: user.displayName || user.name,
      bio: user.email,
      interests: user.interests || [],
    });
  }
  participants.push({
    name: match.name,
    interests: match.sharedInterests || [],
  });
  return {
    match_id: match.id,
    shared_interests: match.sharedInterests || [],
    location: 'Campus',
    participants,
  };
}

function mapIdeasToPlanOptions(match: Match, response: DateIdeasResponse): PlanOptions {
  const base = Date.now() + 2 * 3600 * 1000;
  const options: PlanOption[] = response.ideas.map((idea, idx) => ({
    partnerName: match.name,
    when: new Date(base + idx * 3600 * 1000).toISOString(),
    location: idea.location || 'Campus Center',
    idea: `${idea.title}: ${idea.description}`,
    reasons: [idea.title, idea.location].filter(Boolean) as string[],
    budget: inferBudgetForIdea(idea, idx),
    category: inferCategory(idea.title),
  }));
  return {
    partnerName: match.name,
    matchId: match.id,
    match,
    options,
    generatedAt: response.generated_at,
    cached: response.cached,
  };
}

function inferBudgetForIdea(idea: DateIdea, idx: number): number {
  const title = idea.title.toLowerCase();
  if (title.includes('free') || title.includes('walk') || title.includes('sunset')) return 0;
  if (title.includes('coffee') || title.includes('market') || title.includes('museum')) return 1;
  if (title.includes('dinner') || title.includes('tasting')) return 2;
  if (title.includes('concert') || title.includes('weekend')) return 3;
  return Math.min(3, Math.round(((idea.idea_rank ?? idx) % 4)));
}

function inferCategory(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized.includes('coffee')) return 'Coffee & chats';
  if (normalized.includes('art') || normalized.includes('museum')) return 'Arts & culture';
  if (normalized.includes('park') || normalized.includes('trail') || normalized.includes('outdoor')) return 'Outdoors';
  if (normalized.includes('food') || normalized.includes('dinner')) return 'Foodie moment';
  return 'Connection boost';
}
