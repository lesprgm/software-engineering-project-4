import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SwipeCard, { SwipeCardHandle } from '../components/ui/SwipeCard';
import { useToast } from '../components/ToastProvider';
import { DEFAULT_AVATAR } from '../lib/media';
import { useAuthStore, User as AuthUser } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { aiApi, MatchInsightRequest, ParticipantProfile } from '../services/ai';
import { useGroupMatches, useGroups, useUserMatches } from '../hooks/useGroups';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { useViewNavigate } from '../hooks/useViewNavigate';
import { ViewTransitionLink } from '../components/navigation/ViewTransitionLink';
import { useHistoryStore } from '../store/history';

type Suggestion = {
  id: string;
  type?: 'user' | 'group';
  name: string;
  avatarUrl?: string;
  interests?: string[];
  insight?: string;
  compatibility?: number;
  schedule?: number;
  personality?: number;
  sharedGroups?: string[];
};

type SwipeHistoryPayload = {
  direction: 'left' | 'right';
  matchId: string;
  name: string;
};

export default function Matches() {
  const { notify } = useToast();
  const { addNotification } = useNotifications();
  const currentUser = useAuthStore((state) => state.user);
  useBreadcrumb('Matches', { parent: '/' });
  const navigate = useViewNavigate();
  const [params] = useSearchParams();
  const type = (params.get('type') as 'user' | 'group' | null) || 'user';
  const cardRef = useRef<SwipeCardHandle | null>(null);
  const heroHeight = 'h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)]';
  const [index, setIndex] = useState(0);
  const [swipeFeedback, setSwipeFeedback] = useState<'saved' | 'skipped' | null>(null);
  const pushHistory = useHistoryStore((state) => state.push);
  const undoHistory = useHistoryStore((state) => state.undo);
  const redoHistory = useHistoryStore((state) => state.redo);
  const clearHistory = useHistoryStore((state) => state.clear);
  const pastCount = useHistoryStore((state) => state.past.length);
  const futureCount = useHistoryStore((state) => state.future.length);
  const lastAction = useHistoryStore((state) => state.past[state.past.length - 1]);
  const [undoPrompt, setUndoPrompt] = useState<{ actionId: string; expires: number; name: string } | null>(null);
  const [traitIndex, setTraitIndex] = useState(0);

  const { data: userCandidates, isLoading } = useUserMatches(currentUser?.id);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (type !== 'user' || !userCandidates) return [];
    return userCandidates.map((candidate) => ({
      id: candidate.user_id,
      type: 'user',
      name: candidate.display_name,
      interests: candidate.shared_interests,
      compatibility: candidate.compatibility_score,
      schedule: candidate.schedule_score,
      personality: candidate.personality_overlap,
    }));
  }, [type, userCandidates]);

  useEffect(() => {
    setIndex(0);
    setSwipeFeedback(null);
    setUndoPrompt(null);
    clearHistory();
  }, [suggestions.length, type, clearHistory]);

  const current = useMemo(() => suggestions[index], [suggestions, index]);
  const traitSequence = useMemo(() => {
    if (!current) return ['Shared vibe', 'Schedule sync', 'Personality sparks'];
    const sequence: string[] = [];
    if (typeof current.compatibility === 'number') {
      sequence.push(`${(current.compatibility * 100).toFixed(0)}% compatibility signal`);
    }
    if (current.interests?.length) {
      sequence.push(`${current.interests[0]} synergy`);
    }
    if (typeof current.schedule === 'number') {
      sequence.push(`${Math.round(current.schedule * 100)}% schedule overlap`);
    }
    if (typeof current.personality === 'number') {
      sequence.push(current.personality > 0.6 ? 'Personalities in sync' : 'Complimentary personalities');
    }
    if (!sequence.length) {
      return ['Shared vibe', 'Schedule sync', 'Personality sparks'];
    }
    return sequence;
  }, [current]);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  useEffect(() => {
    if (!undoPrompt) return undefined;
    const remaining = Math.max(0, undoPrompt.expires - Date.now());
    if (remaining <= 0) {
      setUndoPrompt(null);
      return undefined;
    }
    const timer = window.setTimeout(() => setUndoPrompt(null), remaining);
    return () => window.clearTimeout(timer);
  }, [undoPrompt]);

  useEffect(() => {
    let cancelled = false;
    async function loadInsight() {
      if (!current) {
        setInsight(null);
        setInsightLoading(false);
        return;
      }
      setInsightLoading(true);
      try {
        const cached = await aiApi.getMatchInsight(current.id);
        if (!cancelled) {
          setInsight(cached.data.summary_text);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          try {
            const payload = buildInsightRequest(current, currentUser);
            const response = await aiApi.generateMatchInsight(current.id, payload);
            if (!cancelled) setInsight(response.data.summary_text);
          } catch (generationError) {
            console.error('Unable to generate insight', generationError);
          }
        } else {
          console.error('Unable to fetch insight', error);
        }
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    }
    loadInsight();
    return () => {
      cancelled = true;
    };
  }, [current, currentUser]);

  useEffect(() => {
    if (!insightLoading || !traitSequence.length) {
      setTraitIndex(0);
      return;
    }
    setTraitIndex(0);
    const timer = window.setInterval(() => {
      setTraitIndex((prev) => (prev + 1) % traitSequence.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [insightLoading, traitSequence]);

  const vibrate = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(18);
    }
  };

  const applySwipe = useCallback(
    (direction: 'left' | 'right', options?: { skipHistory?: boolean; actionId?: string; skipUndoPrompt?: boolean; silent?: boolean }) => {
      const target = current;
      if (!target) return;
      const actionId = options?.actionId ?? `${target.id}-${Date.now()}`;
      if (!options?.skipHistory) {
        pushHistory({
          id: actionId,
          type: 'swipe',
          payload: {
            direction,
            matchId: target.id,
            name: target.name,
          },
        });
      }

      vibrate();
      if (direction === 'right') {
        addNotification({
          kind: 'match',
          title: 'Match saved',
          body: `You added ${target.name} to your shortlist.`,
        });
        notify('Saved to your shortlist', 'success');
        setUndoPrompt(null);
      } else {
        addNotification({
          kind: 'match',
          title: 'Match skipped',
          body: `You passed on ${target.name}.`,
        });
        notify('Skipped');
        if (!options?.skipUndoPrompt) {
          setUndoPrompt({
            actionId,
            expires: Date.now() + 5000,
            name: target.name,
          });
        }
      }

      if (!options?.silent) {
        const feedback = direction === 'right' ? 'saved' : 'skipped';
        setSwipeFeedback(feedback);
        window.setTimeout(() => setSwipeFeedback(null), 600);
      }

      setIndex((prev) => prev + 1);
    },
    [addNotification, current, notify, pushHistory]
  );

  const handleUndoAction = useCallback(
    (expectedActionId?: string) => {
      if (expectedActionId && (!lastAction || lastAction.id !== expectedActionId)) return;
      const action = undoHistory();
      if (!action || action.type !== 'swipe') return;
      const payload = action.payload as SwipeHistoryPayload;
      setSwipeFeedback(null);
      setUndoPrompt(null);
      setIndex((prev) => Math.max(prev - 1, 0));
      notify(`Undid ${payload.direction === 'right' ? 'save' : 'skip'} for ${payload.name}`, 'success');
    },
    [lastAction, notify, undoHistory]
  );

  const handleRedoAction = useCallback(() => {
    const action = redoHistory();
    if (!action || action.type !== 'swipe') return;
    const payload = action.payload as SwipeHistoryPayload;
    applySwipe(payload.direction, { skipHistory: true, actionId: action.id });
  }, [applySwipe, redoHistory]);

  useEffect(() => {
    if (type !== 'user' || !current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        if (cardRef.current) cardRef.current.swipeRight();
        else applySwipe('right');
      }
      if (event.key === 'ArrowLeft') {
        if (cardRef.current) cardRef.current.swipeLeft();
        else applySwipe('left');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applySwipe, current, type]);

  if (!currentUser?.id) {
    return <div className="text-center text-gray-600">Sign in to see matches.</div>;
  }

  if (type === 'group') {
    return <GroupMatchView currentUserId={currentUser.id} />;
  }

  if (isLoading) return <div>Loading suggestions...</div>;

  const total = suggestions.length;
  const currentNumber = Math.min(index + 1, total);
  const remaining = Math.max(0, total - currentNumber);
  const previewBatch = suggestions.slice(index + 1, Math.min(total, index + 4));

  if (!current) {
    return (
      <Card className="max-w-xl mx-auto p-8 text-center space-y-4 animate-pop">
        <div className="text-2xl font-semibold text-gray-900">You’re all caught up</div>
        <p className="text-gray-600">
          We’ll notify you as soon as new suggestions arrive. In the meantime, browse events or scout hangout spots to plan something fun.
        </p>
          <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={() => navigate('/events')}>Explore events</Button>
          <Button variant="secondary" onClick={() => navigate('/places')}>
            Find a place
          </Button>
        </div>
      </Card>
    );
  }

  const heroTransitionId = current ? `match-hero-${current.id}` : undefined;
  const nameTransitionId = current ? `match-name-${current.id}` : undefined;
  const derivedInsight = insight || current.insight;
  const highlightCards = useMemo(() => {
    if (!current) return [];
    const cards: { title: string; body: string }[] = [];
    if (current.interests?.length) {
      const preview = current.interests.slice(0, 3).join(', ');
      cards.push({
        title: 'Shared interests',
        body: `You both enjoy ${preview}${current.interests.length > 3 ? '…' : ''}`,
      });
    }
    if (typeof current.schedule === 'number') {
      cards.push({
        title: 'Schedule fit',
        body: `${Math.round(current.schedule * 100)}% of your availability lines up.`,
      });
    }
    if (typeof current.personality === 'number') {
      cards.push({
        title: 'Vibe check',
        body: current.personality > 0.6 ? 'Personalities click effortlessly.' : 'Opposites attract—could be fun!',
      });
    }
    return cards;
  }, [current]);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
        <button
          type="button"
          onClick={() => handleUndoAction()}
          disabled={!pastCount}
          className={clsx(
            'rounded-full border px-3 py-1 transition',
            pastCount ? 'border-gray-200 hover:border-gray-400 hover:text-gray-800' : 'border-gray-100 text-gray-300 cursor-not-allowed'
          )}
        >
          Undo
        </button>
        <button
          type="button"
          onClick={handleRedoAction}
          disabled={!futureCount}
          className={clsx(
            'rounded-full border px-3 py-1 transition',
            futureCount ? 'border-gray-200 hover:border-gray-400 hover:text-gray-800' : 'border-gray-100 text-gray-300 cursor-not-allowed'
          )}
        >
          Redo
        </button>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div>
          Match {currentNumber} of {total || '∞'}
        </div>
        {previewBatch.length > 0 && (
          <div className="text-xs text-gray-400">
            Next up:{' '}
            {previewBatch
              .map((candidate) => candidate.name.split(' ')[0])
              .join(', ')}
          </div>
        )}
      </div>
      <SwipeCard
        key={current.id}
        disabled={type !== 'user'}
        ref={cardRef}
        onSwipe={(direction) => applySwipe(direction)}
        className="mb-4"
      >
        <Card className="p-0 overflow-hidden rounded-2xl shadow-xl border-0">
          <div className={`relative ${heroHeight} w-full`}>
            <img
              src={current.avatarUrl || DEFAULT_AVATAR}
              alt="Profile"
              className="h-full w-full object-cover"
              style={heroTransitionId ? { viewTransitionName: heroTransitionId } : undefined}
              onError={(event) => {
                (event.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/80 backdrop-blur text-gray-800 uppercase">
                One-to-one
              </span>
            </div>
            <div className="absolute top-4 right-4">
              <ViewTransitionLink
                to={`/matches/${current.id}`}
                state={{ from: '/matches' }}
                className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 backdrop-blur text-gray-800 shadow hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Full profile
              </ViewTransitionLink>
            </div>
            <div className="absolute bottom-4 left-0 right-0 px-4">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className="text-2xl md:text-3xl font-semibold text-white drop-shadow truncate"
                    style={nameTransitionId ? { viewTransitionName: nameTransitionId } : undefined}
                  >
                    {current.name}
                    {typeof current.compatibility === 'number' && (
                      <span className="ml-2 text-base font-medium text-white/80">
                        {(current.compatibility * 100).toFixed(0)}% match
                      </span>
                    )}
                  </div>
                  {!!current.interests?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {current.interests.slice(0, 6).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] md:text-xs px-2 py-1 rounded-full bg-white/80 backdrop-blur text-gray-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    aria-label="Skip"
                    onClick={() => (cardRef.current ? cardRef.current.swipeLeft() : applySwipe('left'))}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-white text-red-600 shadow-lg ring-1 ring-black/10 hover:scale-105 active:scale-95 transition-transform grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 hover-float"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                      <path
                        fillRule="evenodd"
                        d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Accept"
                    onClick={() => (cardRef.current ? cardRef.current.swipeRight() : applySwipe('right'))}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-white text-green-600 shadow-lg ring-1 ring-black/10 hover:scale-105 active:scale-95 transition-transform grid place-items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 hover-float"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                      <path
                        fillRule="evenodd"
                        d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm14.03-2.53a.75.75 0 10-1.06-1.06L10 13.63l-1.72-1.72a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l5.75-5.75z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {(derivedInsight || insightLoading) && (
            <div className="p-4 md:p-6 bg-white space-y-3">
              <div className="text-sm md:text-base font-semibold text-gray-900 flex items-center justify-between gap-2">
                <span>Match insight</span>
                {insightLoading && <span className="text-xs font-medium text-rose-500">Analyzing…</span>}
              </div>
              {insightLoading ? (
                <div>
                  <p className="text-sm text-gray-600">
                    Analyzing your compatibility… matching traits appear as we decode your vibe.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {traitSequence.map((trait, idx) => (
                      <span
                        key={`${trait}-${idx}`}
                        className={clsx(
                          'px-3 py-1 rounded-full text-xs font-medium transition-all',
                          idx === traitIndex
                            ? 'bg-rose-100 text-rose-700 shadow-inner scale-105'
                            : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm md:text-base text-gray-700 italic">{derivedInsight}</p>
              )}
            </div>
          )}
          {swipeFeedback && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`rounded-full px-6 py-2 text-white text-lg font-semibold shadow-lg animate-pop ${
                  swipeFeedback === 'saved' ? 'bg-green-500/90' : 'bg-gray-900/80'
                }`}
              >
                {swipeFeedback === 'saved' ? 'Saved!' : 'Skipped'}
              </div>
            </div>
          )}
        </Card>
      </SwipeCard>
      <div className="mt-3 text-center text-xs text-gray-500">Swipe (drag) or use Left/Right keys</div>
      {highlightCards.length > 0 && (
        <div className="mt-6">
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
            {highlightCards.map((card, idx) => (
              <div
                key={`${card.title}-${idx}`}
                className="min-w-[220px] snap-start rounded-2xl border border-gray-100 bg-white/80 px-4 py-3 shadow-sm animate-pop"
              >
                <div className="text-xs uppercase tracking-wide text-rose-500 font-semibold">{card.title}</div>
                <p className="text-sm text-gray-700 mt-1">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {undoPrompt && (
        <div className="sticky bottom-4">
          <div className="flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white/90 px-5 py-2 shadow-lg text-sm">
              <span className="text-gray-600">Skipped {undoPrompt.name}</span>
              <button
                type="button"
                onClick={() => handleUndoAction(undoPrompt.actionId)}
                className="text-rose-600 font-semibold hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-400"
              >
                Undo skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildInsightRequest(target: Suggestion, user?: AuthUser | null): MatchInsightRequest {
  const participants: ParticipantProfile[] = [];
  if (user) {
    participants.push({
      name: user.displayName || user.name,
      bio: user.email,
      interests: user.interests || [],
    });
  }
  participants.push({
    name: target.name,
    interests: target.interests || [],
  });
  return {
    participants,
    shared_interests: target.interests || [],
    location: 'Campus',
    mood: target.type === 'group' ? 'collaborative' : 'upbeat',
  };
}

function GroupMatchView({ currentUserId }: { currentUserId: string }) {
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const navigate = useViewNavigate();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (!groups?.length) return;
    if (!selectedGroupId) setSelectedGroupId(groups[0].id);
  }, [groups, selectedGroupId]);

  const { data: groupMatchData, isLoading: matchesLoading } = useGroupMatches(selectedGroupId ?? '');
  const candidates = groupMatchData?.candidates ?? [];
  const activeGroup = groups?.find((group) => group.id === selectedGroupId) || null;

  if (groupsLoading) {
    return <div className="text-center text-gray-600">Loading your groups…</div>;
  }

  if (!groups || groups.length === 0) {
    return (
      <Card className="max-w-xl mx-auto p-6 text-center space-y-3">
        <div className="text-lg font-semibold text-gray-900">Create a group first</div>
        <p className="text-sm text-gray-600">Group matching needs at least one group you belong to. Head over to Groups to start one.</p>
        <Button onClick={() => navigate('/groups')}>Go to Groups</Button>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-gray-400">Select group</div>
        <div className="flex flex-wrap gap-2">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                selectedGroupId === group.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-gray-400'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Group</div>
            <div className="text-xl font-semibold text-gray-900">{activeGroup?.name}</div>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/groups/${activeGroup?.id || ''}`)} disabled={!activeGroup}>
            View details
          </Button>
        </div>

        {matchesLoading ? (
          <div className="text-sm text-gray-500">Scanning for compatible groups…</div>
        ) : candidates.length === 0 ? (
          <div className="text-sm text-gray-500">No overlapping availability yet. Encourage members to add availability to unlock matches.</div>
        ) : (
          <div className="space-y-3">
            {candidates.map((candidate) => (
              <div key={candidate.group_id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-900">{candidate.group_name}</div>
                  <div className="text-sm text-gray-500">
                    Availability overlap {(candidate.overlap_minutes / 60).toFixed(1)} hrs · Size {candidate.size}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-gray-400">Score</div>
                    <div className="text-2xl font-semibold text-blue-600">{Math.round(candidate.compatibility_score)}</div>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(`/groups/${candidate.group_id}`)}>
                    Inspect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
