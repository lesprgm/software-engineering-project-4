import { useEffect, useMemo, useState } from 'react';
import { FALLBACK_GROUPS } from '../data/fallbackGroups';
import { clsx } from 'clsx';
import { useGroups, useCreateGroup } from '../hooks/useGroups';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { useToast } from '../components/ToastProvider';
import Skeleton from '../components/ui/Skeleton';
import { useViewNavigate } from '../hooks/useViewNavigate';
import { useBreadcrumb } from '../hooks/useBreadcrumb';

type GroupTemplate = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  emoji: string;
};

const GROUP_TEMPLATES: GroupTemplate[] = [
  {
    id: 'study',
    name: 'Focused study sprint',
    description: 'Pomodoro-powered study pod with shared playlists and accountability check-ins.',
    tags: ['Library nook', 'Lofi playlists', 'Goal recaps'],
    emoji: '📚',
  },
  {
    id: 'weekend',
    name: 'Weekend adventure club',
    description: 'Plan quick Saturday adventures—coffee crawls, hikes, or local events.',
    tags: ['Low planning', 'Outdoor friendly', 'Flexible invite'],
    emoji: '🌲',
  },
  {
    id: 'wellness',
    name: 'Mindful midweek reset',
    description: 'Midweek hangs for journaling, yoga, or decompressing with tea.',
    tags: ['Mindfulness', 'Small circle', 'Hybrid meetups'],
    emoji: '🧘‍♀️',
  },
];

const CADENCE_OPTIONS = ['Weekly check-in', 'Bi-weekly hangs', 'Weekend only'];

export default function Groups() {
  const { user } = useAuthStore();
  const navigate = useViewNavigate();
  useBreadcrumb('Groups', { parent: '/' });
  const { notifications } = useNotifications();
  const { notify } = useToast();
  const { data: groups, isLoading } = useGroups();
  const createGroup = useCreateGroup();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(GROUP_TEMPLATES[0].id);
  const [selectedCadence, setSelectedCadence] = useState(CADENCE_OPTIONS[0]);
  const [groupSize, setGroupSize] = useState(4);
  const [wizardAutoOpened, setWizardAutoOpened] = useState(false);
  const selectedTemplate = useMemo(
    () => GROUP_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? GROUP_TEMPLATES[0],
    [selectedTemplateId]
  );

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !groupName.trim()) {
      notify('Please provide a group name', 'error');
      return;
    }

    try {
      await createGroup.mutateAsync({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        owner_id: user.id,
      });
      setGroupName('');
      setGroupDescription('');
      setShowCreateForm(false);
      notify('Group created successfully!', 'success');
    } catch (error) {
      console.error('Failed to create group:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create group. Please try again.';
      notify(errorMessage, 'error');
    }
  };

  const applyTemplate = (template: GroupTemplate) => {
    setSelectedTemplateId(template.id);
    setGroupName(template.name);
    const cadenceSuffix = selectedCadence ? ` (${selectedCadence})` : '';
    setGroupDescription(`${template.description}${cadenceSuffix}`);
    setShowCreateForm(true);
  };

  const groupsArray = Array.isArray(groups) ? groups : [];
  const cardsLoading = isLoading && groupsArray.length === 0;
  const showFallback = groupsArray.length === 0 && !isLoading;
  const groupsDisplay = useMemo(() => (showFallback ? FALLBACK_GROUPS : groupsArray), [groupsArray, showFallback]);
  const noRealGroups = !cardsLoading && groupsArray.length === 0;

  useEffect(() => {
    if (noRealGroups && !wizardAutoOpened) {
      setShowCreateForm(true);
      setWizardAutoOpened(true);
    }
  }, [noRealGroups, wizardAutoOpened]);

  return (
    <div className="min-h-screen bg-white text-slate-900 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Spaces</p>
            <h1 className="text-3xl font-semibold">Groups</h1>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-full border border-slate-900/10 px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            {showCreateForm ? 'Close form' : 'New group'}
          </button>
        </div>

        {noRealGroups && (
          <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 space-y-5">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-slate-500">Start simple</p>
              <h2 className="text-xl font-semibold">Pick a preset to auto-fill the form</h2>
              <p className="text-sm text-slate-500">Everything stays editable — these just save you a few keystrokes.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {GROUP_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className={clsx(
                    'rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-400',
                    selectedTemplateId === template.id && 'border-slate-900'
                  )}
                >
                  <div className="text-2xl">{template.emoji}</div>
                  <div className="mt-2 text-sm font-medium">{template.name}</div>
                  <p className="text-xs text-slate-500 mt-1">{template.description}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {CADENCE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setSelectedCadence(option)}
                  className={clsx(
                    'rounded-full border border-slate-300 px-3 py-1 text-xs',
                    selectedCadence === option && 'border-slate-900 text-slate-900'
                  )}
                >
                  {option}
                </button>
              ))}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <label htmlFor="group-size-slider">Size {groupSize}</label>
                <input
                  id="group-size-slider"
                  type="range"
                  min={3}
                  max={12}
                  value={groupSize}
                  onChange={(event) => setGroupSize(Number(event.target.value))}
                  className="accent-slate-900"
                />
              </div>
            </div>
          </section>
        )}

        {/* Create Group Form */}
        {showCreateForm && (
          <section className="rounded-2xl border border-slate-200 p-5 space-y-4">
            <h2 className="text-lg font-semibold">Create group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <label className="text-sm">
                <span className="text-slate-500">Group name</span>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Study pod, weekend adventures…"
                  required
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Description</span>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="What’s the vibe?"
                  rows={3}
                />
              </label>
              <button
                type="submit"
                disabled={createGroup.isPending}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {createGroup.isPending ? 'Creating…' : 'Save group'}
              </button>
            </form>
          </section>
        )}

        {showFallback && (
          <p className="text-sm text-slate-500">
            Showing sample hangouts while the live groups service reconnects.
          </p>
        )}

        {/* Groups List */}
        <div className="space-y-4">
          {cardsLoading && (
            <>
              <Skeleton className="h-32 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </>
          )}
          {!cardsLoading && !groupsDisplay.length && (
            <div className="rounded-lg bg-white p-8 text-center shadow">
              <p className="text-gray-500">
                No groups yet. Create one to get started!
              </p>
            </div>
          )}
          {!cardsLoading &&
            groupsDisplay.map((group) => {
              const createdDate = group.created_at ? new Date(group.created_at) : new Date();
              const nextMeeting = new Date(createdDate.getTime() + 5 * 24 * 60 * 60 * 1000);
              const unread = notifications.filter((note) =>
                (note.title + note.body).toLowerCase().includes(group.name.toLowerCase()),
              ).length;
              const daysActive = Math.max(1, Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
              return (
                <div
                  key={group.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        {group.name}
                        <span className="text-xs text-slate-400">Day {daysActive}</span>
                      </h3>
                      {group.description && (
                        <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-wide text-slate-400">
                        <span>Next meetup · {nextMeeting.toLocaleDateString()}</span>
                        <span>Unread · {showFallback ? '—' : unread}</span>
                        <span>Created · {createdDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                    {showFallback ? (
                      <span className="rounded-full border border-slate-200 px-4 py-1 text-xs text-slate-500">
                        Sample group
                      </span>
                    ) : (
                      <div className="flex flex-col gap-2 text-sm">
                        <button
                          onClick={() => navigate(`/groups/${group.id}`)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-slate-300"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => navigate(`/groups/${group.id}?tab=schedule`)}
                          className="rounded-full bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                        >
                          Plan a hangout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
