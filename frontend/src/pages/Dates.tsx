import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import api from '../lib/api';
import Modal from '../components/ui/Modal';
import { useToast } from '../components/ToastProvider';
import { useNavigate } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';

type DateEvent = { id: string; partnerName: string; when: string; location?: string; status: 'proposed' | 'confirmed' };
type Match = { id: string; name: string; avatarUrl?: string; sharedInterests?: string[] };
type Plan = { partnerName: string; when: string; location: string; idea: string };
type PlanOption = Plan & { reasons?: string[] };
type PlanOptions = { partnerName: string; options: PlanOption[] };
type InboxProposal = { id: string; partnerName: string; when: string; location: string; idea: string };

export default function Dates() {
  const [openOptions, setOpenOptions] = useState<PlanOptions | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customWhen, setCustomWhen] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customIdea, setCustomIdea] = useState('');
  const { notify } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const matchesQ = useQuery({
    queryKey: ['date-matches'],
    queryFn: async () => (await api.get('/dates/matches')).data as Match[],
  });

  const upcomingQ = useQuery({
    queryKey: ['dates-upcoming'],
    queryFn: async () => (await api.get('/dates/upcoming')).data as DateEvent[],
  });

  const inboxQ = useQuery({
    queryKey: ['dates-inbox'],
    queryFn: async () => (await api.get('/dates/inbox')).data as InboxProposal[],
  });

  const optionsMut = useMutation({
    mutationFn: async (matchId: string) => (await api.post('/dates/options', { matchId })).data as PlanOptions,
    onSuccess: (res) => { setSelectedIdx(null); setCustomOpen(false); setOpenOptions(res); },
  });

  const proposeMut = useMutation({
    mutationFn: async (payload: { matchId: string; plan: Plan }) => (await api.post('/dates/propose', payload)).data,
    onSuccess: async () => {
      setOpenOptions(null);
      notify('Proposal sent', 'success');
      await qc.invalidateQueries({ queryKey: ['dates-upcoming'] });
    },
  });

  const [accepting, setAccepting] = useState<InboxProposal | null>(null);
  const [acceptWhen, setAcceptWhen] = useState('');
  const acceptMut = useMutation({
    mutationFn: async (payload: { proposalId: string; when: string }) => (await api.post('/dates/accept', payload)).data,
    onSuccess: async () => {
      setAccepting(null);
      notify('Date confirmed', 'success');
      await qc.invalidateQueries({ queryKey: ['dates-inbox'] });
      await qc.invalidateQueries({ queryKey: ['dates-upcoming'] });
    },
  });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your matches</h2>
        </div>
        {matchesQ.isLoading && <div>Loading matches…</div>}
        <div className="grid sm:grid-cols-2 gap-4">
          {matchesQ.data?.map((m) => (
            <div key={m.id} className="flex items-center gap-4 p-2 sm:p-3 bg-transparent">
              <Avatar src={m.avatarUrl || ''} className="w-14 h-14 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{m.name}</div>
                {!!m.sharedInterests?.length && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.sharedInterests.slice(0, 4).map((s) => (
                      <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={() => optionsMut.mutate(m.id)} loading={optionsMut.isPending} aria-label={`Get date options with ${m.name}`}>
                See date options
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <div className="text-lg font-semibold mb-3">Upcoming dates</div>
        {upcomingQ.isLoading && <div>Loading…</div>}
        {!upcomingQ.data?.length && !upcomingQ.isLoading && (
          <div className="text-sm text-gray-600">No dates scheduled yet.</div>
        )}
        <div className="space-y-3">
          {upcomingQ.data?.map((ev) => (
            <div key={ev.id} className="p-2 sm:p-3 bg-transparent">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{ev.partnerName}</div>
                  <div className="text-sm text-gray-600">{new Date(ev.when).toLocaleString()} {ev.location ? `• ${ev.location}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  {ev.status === 'proposed' ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">Awaiting response</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">Confirmed</span>
                  )}
                  <Button variant="secondary" onClick={() => navigate(`/messages?with=${encodeURIComponent(ev.partnerName)}`)}>Message</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="lg:col-span-3 p-6">
        <div className="text-lg font-semibold mb-3">Proposals for you</div>
        {inboxQ.isLoading && <div>Loading…</div>}
        {!inboxQ.data?.length && !inboxQ.isLoading && (
          <div className="text-sm text-gray-600">No new proposals right now.</div>
        )}
        <div className="space-y-3">
          {inboxQ.data?.map((p) => (
            <div key={p.id} className="p-3 bg-transparent">
              <div className="text-sm text-gray-700">
                <div className="mb-1 font-medium">Based on your interests, here’s a plan with {p.partnerName}:</div>
                <div><span className="font-medium">When:</span> {new Date(p.when).toLocaleString()}</div>
                <div><span className="font-medium">Where:</span> {p.location}</div>
                <p className="mt-1">{p.idea}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => { setAccepting(p); setAcceptWhen(p.when.substring(0,16)); }}>Accept</Button>
                <Button variant="secondary" onClick={() => { setOpenOptions({ partnerName: p.partnerName, options: [{ partnerName: p.partnerName, when: p.when, location: p.location, idea: p.idea }] }); setSelectedIdx(0); setCustomOpen(true); }}>Suggest something else</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={!!openOptions} onClose={() => setOpenOptions(null)} title={openOptions ? `Pick a plan with ${openOptions.partnerName}` : ''}>
        {openOptions && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Based on your shared interests, here are a couple of ideas to choose from. Pick one or suggest your own.</p>
            <p className="text-sm text-gray-600">Based on your shared interests, here are a couple of ideas to choose from. Pick one or suggest your own.</p>
            <div className="grid md:grid-cols-2 gap-3">
              {openOptions.options.map((opt, idx) => (
                <label key={idx} className={`block rounded-xl p-3 cursor-pointer transition-shadow ${selectedIdx === idx ? 'ring-2 ring-rose-600' : ''}`}>
                  <input
                    type="radio"
                    name="plan"
                    className="sr-only"
                    checked={selectedIdx === idx}
                    onChange={() => setSelectedIdx(idx)}
                  />
                  <div className="text-sm text-gray-700">
                    <div><span className="font-medium">When:</span> {new Date(opt.when).toLocaleString()}</div>
                    <div><span className="font-medium">Where:</span> {opt.location}</div>
                    <p className="mt-1 text-gray-700">{opt.idea}</p>
                    {!!opt.reasons?.length && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="mr-2 text-gray-500">Why this plan:</span>
                        <span className="inline-flex flex-wrap gap-1 align-middle">
                          {opt.reasons.map((r, i) => (
                            <span
                              key={`${r}-${i}`}
                              className="inline-flex items-center rounded-full border border-gray-300 bg-white/80 px-2 py-0.5 text-[11px] text-gray-700"
                              aria-label={`reason ${r}`}
                            >
                              {r}
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
                onClick={() => selectedIdx !== null && proposeMut.mutate({ matchId: (matchesQ.data || [])[0]?.id || 'm1', plan: openOptions.options[selectedIdx] })}
                disabled={selectedIdx === null}
                loading={proposeMut.isPending}
              >
                Send proposal
              </Button>
              <Button variant="secondary" onClick={() => setCustomOpen((v) => !v)}>
                Suggest something else
              </Button>
            </div>

            {customOpen && (
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="grid md:grid-cols-2 gap-2">
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">When</span>
                    <input type="datetime-local" value={customWhen} onChange={(e) => setCustomWhen(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-gray-700">Where</span>
                    <input type="text" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} placeholder="Location" className="w-full rounded-md border border-gray-300 px-3 py-2" />
                  </label>
                </div>
                <label className="text-sm block">
                  <span className="mb-1 block text-gray-700">Plan details</span>
                  <textarea rows={3} value={customIdea} onChange={(e) => setCustomIdea(e.target.value)} placeholder="What should we do?" className="w-full rounded-md border border-gray-300 px-3 py-2" />
                </label>
                <div>
                  <Button
                    onClick={() => {
                      if (!customWhen || !customLocation) return;
                      const p: Plan = { partnerName: openOptions.partnerName, when: new Date(customWhen).toISOString(), location: customLocation, idea: customIdea || 'Fun hangout' };
                      proposeMut.mutate({ matchId: (matchesQ.data || [])[0]?.id || 'm1', plan: p });
                    }}
                    loading={proposeMut.isPending}
                  >
                    Send custom proposal
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!accepting} onClose={() => setAccepting(null)} title={accepting ? `Confirm date with ${accepting.partnerName}` : ''}>
        {accepting && (
          <div className="space-y-3 text-sm">
            <div className="text-gray-700">Confirm the time or adjust it before accepting.</div>
            <label className="text-sm block">
              <span className="mb-1 block text-gray-700">Date & time</span>
              <input type="datetime-local" value={acceptWhen} onChange={(e) => setAcceptWhen(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2" />
            </label>
            <div className="flex gap-2">
              <Button onClick={() => acceptMut.mutate({ proposalId: accepting.id, when: new Date(acceptWhen || accepting.when).toISOString() })} loading={acceptMut.isPending}>Accept</Button>
              <Button variant="secondary" onClick={() => setAccepting(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
