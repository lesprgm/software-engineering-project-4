import axios from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SwipeCard, { SwipeCardHandle } from '../components/ui/SwipeCard';
import { useToast } from '../components/ToastProvider';
import { DEFAULT_AVATAR } from '../lib/media';
import { useAuthStore, User as AuthUser } from '../store/auth';
import { aiApi, MatchInsightRequest, ParticipantProfile } from '../services/ai';
import { useUserMatches } from '../hooks/useGroups';

type Suggestion = {
  id: string;
  type?: 'user' | 'group';
  name: string;
  avatarUrl?: string;
  interests?: string[];
  insight?: string;
  compatibility?: number;
};

export default function Matches() {
  const { notify } = useToast();
  const currentUser = useAuthStore((state) => state.user);
  const [params] = useSearchParams();
  const type = (params.get('type') as 'user' | 'group' | null) || 'user';
  const cardRef = useRef<SwipeCardHandle | null>(null);
  const heroHeight = 'h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)]';
  const [index, setIndex] = useState(0);

  const { data: userCandidates, isLoading } = useUserMatches(currentUser?.id);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (type !== 'user' || !userCandidates) return [];
    return userCandidates.map((candidate) => ({
      id: candidate.user_id,
      type: 'user',
      name: candidate.display_name,
      interests: candidate.shared_interests,
      compatibility: candidate.compatibility_score,
    }));
  }, [type, userCandidates]);

  useEffect(() => {
    setIndex(0);
  }, [suggestions.length, type]);

  const current = useMemo(() => suggestions[index], [suggestions, index]);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

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

  const handleAccept = () => {
    notify('Saved to your shortlist', 'success');
    setIndex((prev) => prev + 1);
  };

  const handleSkip = () => {
    notify('Skipped');
    setIndex((prev) => prev + 1);
  };

  useEffect(() => {
    if (type !== 'user' || !current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        if (cardRef.current) cardRef.current.swipeRight();
        else handleAccept();
      }
      if (event.key === 'ArrowLeft') {
        if (cardRef.current) cardRef.current.swipeLeft();
        else handleSkip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, type]);

  if (!currentUser?.id) {
    return <div className="text-center text-gray-600">Sign in to see matches.</div>;
  }

  if (isLoading) return <div>Loading suggestions...</div>;
  if (type !== 'user') return <div>Group matching is coming soon.</div>;
  if (!current) return <div>No more suggestions. Check back later.</div>;

  const derivedInsight = insight || current.insight;

  return (
    <div className="max-w-3xl mx-auto">
      <SwipeCard
        key={current.id}
        disabled={type !== 'user'}
        ref={cardRef}
        onSwipe={(direction) => (direction === 'right' ? handleAccept() : handleSkip())}
        className="mb-4"
      >
        <Card className="p-0 overflow-hidden rounded-2xl shadow-xl border-0">
          <div className={`relative ${heroHeight} w-full`}>
            <img
              src={current.avatarUrl || DEFAULT_AVATAR}
              alt="Profile"
              className="h-full w-full object-cover"
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
            <div className="absolute bottom-4 left-0 right-0 px-4">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl md:text-3xl font-semibold text-white drop-shadow truncate">
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
                    onClick={() => (cardRef.current ? cardRef.current.swipeLeft() : handleSkip())}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-white text-red-600 shadow-lg ring-1 ring-black/10 hover:scale-105 transition-transform grid place-items-center"
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
                    onClick={() => (cardRef.current ? cardRef.current.swipeRight() : handleAccept())}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-white text-green-600 shadow-lg ring-1 ring-black/10 hover:scale-105 transition-transform grid place-items-center"
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
            <div className="p-4 md:p-6 bg-white">
              <div className="text-sm md:text-base text-gray-800">
                <span className="font-semibold">Match insight:</span>{' '}
                {insightLoading ? (
                  <span className="italic text-gray-400">Generating personalized summary…</span>
                ) : (
                  <span className="italic text-gray-700">{derivedInsight}</span>
                )}
              </div>
            </div>
          )}
        </Card>
      </SwipeCard>
      <div className="mt-3 text-center text-xs text-gray-500">Swipe (drag) or use Left/Right keys</div>
    </div>
  );
}

function buildInsightRequest(target: Suggestion, user?: AuthUser | null): MatchInsightRequest {
  const participants: ParticipantProfile[] = [];
  if (user) {
    participants.push({
      name: user.name,
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
