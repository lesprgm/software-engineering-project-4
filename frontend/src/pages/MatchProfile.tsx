import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useUserMatches } from '../hooks/useGroups';
import { useAuthStore } from '../store/auth';
import { DEFAULT_AVATAR } from '../lib/media';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { ViewTransitionLink } from '../components/navigation/ViewTransitionLink';
import { useViewNavigate } from '../hooks/useViewNavigate';

export default function MatchProfile() {
  const { matchId } = useParams<{ matchId: string }>();
  const me = useAuthStore((state) => state.user);
  const navigate = useViewNavigate();
  const { data: candidates, isLoading } = useUserMatches(me?.id);
  const match = useMemo(() => candidates?.find((candidate) => candidate.user_id === matchId), [candidates, matchId]);

  useBreadcrumb(match ? match.display_name : 'Match profile', { parent: '/matches' });

  if (isLoading) {
    return <div className="text-center text-gray-500">Loading profile…</div>;
  }

  if (!match) {
    return (
      <Card className="p-8 text-center space-y-3">
        <div className="text-lg font-semibold text-gray-800">Match not found</div>
        <p className="text-gray-600">Head back to matches to refresh your deck.</p>
        <Button onClick={() => navigate('/matches')}>Return to matches</Button>
      </Card>
    );
  }

  const heroTransitionId = `match-hero-${match.user_id}`;
  const nameTransitionId = `match-name-${match.user_id}`;
  const heroImage = (match as any).avatar_url || (match as any).avatarUrl || DEFAULT_AVATAR;
  const compatibility = match.compatibility_score ? Math.round(match.compatibility_score * 100) : null;
  const schedule = match.schedule_score ? Math.round(match.schedule_score * 100) : null;
  const personality = match.personality_overlap ? Math.round(match.personality_overlap * 100) : null;

  return (
    <div className="space-y-6">
      <Card className="p-0 overflow-hidden">
        <div className="relative h-80 md:h-[420px]">
          <img
            src={heroImage}
            alt={match.display_name}
            className="h-full w-full object-cover"
            style={{ viewTransitionName: heroTransitionId }}
            onError={(event) => {
              (event.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
            <div
              className="text-3xl font-semibold drop-shadow"
              style={{ viewTransitionName: nameTransitionId }}
            >
              {match.display_name}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-wide text-white/80">
              {match.shared_interests?.slice(0, 4).map((interest) => (
                <span key={interest} className="rounded-full bg-white/20 px-3 py-1 backdrop-blur">
                  {interest}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => navigate('/messages', { state: { with: match.display_name } })}>Say hi</Button>
            <Button variant="secondary" onClick={() => navigate('/dates')}>Plan a date</Button>
            <ViewTransitionLink to="/matches" className="text-sm font-semibold text-gray-600 hover:text-gray-900 underline">
              Back to matches
            </ViewTransitionLink>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-gray-500">Compatibility</div>
          <div className="text-2xl font-semibold text-gray-900">{compatibility ?? '—'}%</div>
          <p className="text-sm text-gray-600">Blend of interests, schedule, and personality.</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-gray-500">Schedule overlap</div>
          <div className="text-2xl font-semibold text-gray-900">{schedule ?? '—'}%</div>
          <p className="text-sm text-gray-600">Shared free windows in the next 2 weeks.</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="text-xs uppercase tracking-wide text-gray-500">Personality vibe</div>
          <div className="text-2xl font-semibold text-gray-900">{personality ?? '—'}%</div>
          <p className="text-sm text-gray-600">
            {personality && personality > 60 ? 'Very aligned' : 'Complimentary energy'}
          </p>
        </Card>
      </div>

      {match.shared_interests?.length ? (
        <Card className="p-6 space-y-2">
          <div className="text-lg font-semibold text-gray-900">Shared interests</div>
          <div className="flex flex-wrap gap-2">
            {match.shared_interests.map((interest) => (
              <span key={interest} className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700">
                {interest}
              </span>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
