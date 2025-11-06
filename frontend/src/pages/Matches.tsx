import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SwipeCard, { SwipeCardHandle } from '../components/ui/SwipeCard';
import { useToast } from '../components/ToastProvider';
import { DEFAULT_AVATAR } from '../lib/media';

type Suggestion = {
  id: string;
  type?: 'user' | 'group';
  name: string;
  avatarUrl?: string;
  interests?: string[];
  insight?: string; // AI summary if provided by backend
};

export default function Matches() {
  const { notify } = useToast();
  const qc = useQueryClient();
  const bypass = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === '1';
  const [params] = useSearchParams();
  const type = (params.get('type') as 'user' | 'group' | null) || 'user';
  const cardRef = useRef<SwipeCardHandle | null>(null);
  const heroHeight = 'h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)]';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['match-suggestions', type],
    queryFn: async () => (await api.get('/matches/suggestions', { params: { type } })).data as Suggestion[],
  });

  const [index, setIndex] = useState(0);
  const suggestions = useMemo(() => data || [], [data]);
  const current = useMemo(() => suggestions[index], [suggestions, index]);

  const accept = useMutation({
    mutationFn: async (id: string) => (await api.post(`/matches/${id}/accept`)).data,
    onSuccess: () => { notify('Accepted', 'success'); qc.invalidateQueries({ queryKey: ['match-suggestions'] }); },
  });

  const skip = useMutation({
    mutationFn: async (id: string) => (await api.post(`/matches/${id}/skip`)).data,
    onSuccess: () => { notify('Skipped'); qc.invalidateQueries({ queryKey: ['match-suggestions'] }); },
  });

  function handleAccept(id: string) {
    if (bypass) {
      notify('Accepted', 'success');
      setIndex((i) => i + 1);
    } else {
      accept.mutate(id, { onSuccess: () => setIndex((i) => i + 1) });
    }
  }

  function handleSkip(id: string) {
    if (bypass) {
      notify('Skipped');
      setIndex((i) => i + 1);
    } else {
      skip.mutate(id, { onSuccess: () => setIndex((i) => i + 1) });
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === 'ArrowRight') {
        if (type === 'user' && cardRef.current) cardRef.current.swipeRight();
        else handleAccept(current.id);
      }
      if (e.key === 'ArrowLeft') {
        if (type === 'user' && cardRef.current) cardRef.current.swipeLeft();
        else handleSkip(current.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  if (isLoading) return <div>Loading suggestions...</div>;
  if (isError) return <div>Failed to load suggestions</div>;
  if (!current) return <div>No more suggestions. Check back later.</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <SwipeCard
        key={current.id}
        disabled={type !== 'user'}
        ref={cardRef}
        onSwipe={(dir) => (dir === 'right' ? handleAccept(current.id) : handleSkip(current.id))}
        className="mb-4"
      >
        <Card className="p-0 overflow-hidden rounded-2xl shadow-xl border-0">
          <div className={`relative ${heroHeight} w-full`}>
            <img
              src={current.avatarUrl || DEFAULT_AVATAR}
              alt="Profile"
              className="h-full w-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute top-4 left-4">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-white/80 backdrop-blur text-gray-800 uppercase">
                {type === 'user' ? 'One-to-one' : 'Group'}
              </span>
            </div>
            <div className="absolute bottom-4 left-0 right-0 px-4">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-2xl md:text-3xl font-semibold text-white drop-shadow truncate">{current.name}</div>
                  {!!current.interests?.length && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {current.interests.slice(0, 6).map((tag) => (
                        <span key={tag} className="text-[11px] md:text-xs px-2 py-1 rounded-full bg-white/80 backdrop-blur text-gray-800">
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
                    onClick={() => (type === 'user' && cardRef.current ? cardRef.current.swipeLeft() : handleSkip(current.id))}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-white text-red-600 shadow-lg ring-1 ring-black/10 hover:scale-105 transition-transform grid place-items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                      <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 11-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Accept"
                    onClick={() => (type === 'user' && cardRef.current ? cardRef.current.swipeRight() : handleAccept(current.id))}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-white text-green-600 shadow-lg ring-1 ring-black/10 hover:scale-105 transition-transform grid place-items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7">
                      <path fillRule="evenodd" d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm14.03-2.53a.75.75 0 10-1.06-1.06L10 13.63l-1.72-1.72a.75.75 0 10-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l5.75-5.75z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {current.insight && (
            <div className="p-4 md:p-6 bg-white">
              <div className="text-sm md:text-base text-gray-800">
                <span className="font-semibold">Match insight:</span>{' '}
                <span className="italic text-gray-700">{current.insight}</span>
              </div>
            </div>
          )}
        </Card>
      </SwipeCard>
      <div className="mt-3 text-center text-xs text-gray-500">Swipe (drag) or use Left/Right keys</div>
    </div>
  );
}








