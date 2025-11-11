import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Avatar from '../components/ui/Avatar';
import { useToast } from '../components/ToastProvider';
import { useAuthStore, User as AuthUser } from '../store/auth';
import { aiApi, DateIdeaRequest, DateIdeasResponse, ParticipantProfile } from '../services/ai';
import { useUserMatches } from '../hooks/useGroups';

type Match = { id: string; name: string; avatarUrl?: string; sharedInterests?: string[] };
type Plan = { partnerName: string; when: string; location: string; idea: string };
type SavedPlan = Plan & { id: string };
type PlanOption = Plan & { reasons?: string[] };
type PlanOptions = {
  partnerName: string;
  matchId?: string;
  options: PlanOption[];
  generatedAt?: string;
  cached?: boolean;
};

export default function Dates() {
  const [openOptions, setOpenOptions] = useState<PlanOptions | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customWhen, setCustomWhen] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customIdea, setCustomIdea] = useState('');

  const { notify } = useToast();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);

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
      setSelectedIdx(null);
      setCustomOpen(false);
      setOpenOptions(mapIdeasToPlanOptions(match, response));
    },
    onError: () => notify('Could not generate ideas right now. Try again later.', 'error'),
  });

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);

  const handlePlanSelection = (plan: Plan) => {
    const saved: SavedPlan = { ...plan, id: `${plan.partnerName}-${Date.now()}` };
    setSavedPlans((prev) => [saved, ...prev]);
    notify(`Plan saved! Share it with ${plan.partnerName} to confirm.`, 'success');
    setOpenOptions(null);
    setSelectedIdx(null);
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
        {matchesLoading && <div>Loading matches…</div>}
        <div className="grid sm:grid-cols-2 gap-4">
          {matches.map((match) => (
            <div key={match.id} className="flex items-center gap-4 p-2 sm:p-3">
              <Avatar src={match.avatarUrl || ''} className="w-14 h-14 rounded-full object-cover" />
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
                See date ideas
              </Button>
            </div>
          ))}
        </div>
        {!matches.length && !matchesLoading && (
          <div className="text-center text-gray-500 mt-6">No matches yet. Find someone in the Matches tab!</div>
        )}
      </Card>

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
            <p className="text-sm text-gray-600">
              Based on your shared interests, here are a few ideas. Save one, or customize your own.
            </p>
            {openOptions.generatedAt && (
              <p className="text-xs text-gray-500">
                Generated {new Date(openOptions.generatedAt).toLocaleString()}
                {openOptions.cached ? ' (cached)' : ''}
              </p>
            )}

            <div className="grid md:grid-cols-2 gap-3">
              {openOptions.options.map((option, idx) => (
                <label key={idx} className={`block rounded-xl p-3 cursor-pointer transition-shadow ${selectedIdx === idx ? 'ring-2 ring-blue-600' : ''}`}>
                  <input
                    type="radio"
                    name="plan"
                    className="sr-only"
                    checked={selectedIdx === idx}
                    onChange={() => setSelectedIdx(idx)}
                  />
                  <div className="text-sm text-gray-700">
                    <div><span className="font-medium">When:</span> {new Date(option.when).toLocaleString()}</div>
                    <div><span className="font-medium">Where:</span> {option.location}</div>
                    <p className="mt-1 text-gray-700">{option.idea}</p>
                    {!!option.reasons?.length && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="mr-2 text-gray-500">Why this plan:</span>
                        <span className="inline-flex flex-wrap gap-1 align-middle">
                          {option.reasons.map((reason, reasonIdx) => (
                            <span key={`${reason}-${reasonIdx}`} className="inline-flex items-center rounded-full border border-gray-300 bg-white/80 px-2 py-0.5 text-[11px] text-gray-700">
                              {reason}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => selectedIdx !== null && handlePlanSelection(openOptions.options[selectedIdx])}
                disabled={selectedIdx === null}
              >
                Save plan
              </Button>
              <Button variant="secondary" onClick={() => setCustomOpen((value) => !value)}>
                Suggest something else
              </Button>
            </div>

            {customOpen && (
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="grid md:grid-cols-2 gap-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">When</span>
                    <input
                      type="datetime-local"
                      value={customWhen}
                      onChange={(event) => setCustomWhen(event.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Where</span>
                    <input
                      type="text"
                      value={customLocation}
                      onChange={(event) => setCustomLocation(event.target.value)}
                      placeholder="Location"
                      className="w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </label>
                </div>
                <label className="text-sm block">
                  <span className="mb-1 block text-gray-700">Plan details</span>
                  <textarea
                    rows={3}
                    value={customIdea}
                    onChange={(event) => setCustomIdea(event.target.value)}
                    placeholder="What should we do?"
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
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
      name: user.name,
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
  }));
  return {
    partnerName: match.name,
    matchId: match.id,
    options,
    generatedAt: response.generated_at,
    cached: response.cached,
  };
}
