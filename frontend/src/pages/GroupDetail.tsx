import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useGroup,
  useGroupMessages,
  usePostMessage,
  useInviteLink,
  useGroupAvailability,
  useAddAvailability,
  useMeetingSuggestions,
  useConfirmMeeting,
  useGroupMatches,
} from '../hooks/useGroups';
import { useToast } from '../components/ToastProvider';
import { downloadCalendarFile } from '../lib/calendar';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { ViewTransitionLink } from '../components/navigation/ViewTransitionLink';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuthStore();
  const { notify } = useToast();
  const { addNotification } = useNotifications();
  
  const { data: group } = useGroup(groupId!);
  const { data: messagesData } = useGroupMessages(groupId!);
  const { data: inviteLink } = useInviteLink(groupId!);
  const { data: availability } = useGroupAvailability(groupId!);
  const { data: matches } = useGroupMatches(groupId!);
  
  const postMessage = usePostMessage(groupId!);
  const addAvailability = useAddAvailability(groupId!);
  const getSuggestions = useMeetingSuggestions(groupId!);
  const confirmMeeting = useConfirmMeeting(groupId!);

  const [messageContent, setMessageContent] = useState('');
  const [showAvailabilityForm, setShowAvailabilityForm] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  
  const [activeTab, setActiveTab] = useState<'chat' | 'schedule' | 'matches'>('chat');
  useBreadcrumb(group?.name ?? 'Group detail', { parent: '/groups' });
  const tabLabels = {
    chat: 'Chat',
    schedule: 'Schedule',
    matches: 'Group matches',
  } as const;
  const activeTabLabel = tabLabels[activeTab];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !messageContent.trim()) return;

    try {
      await postMessage.mutateAsync({
        user_id: user.id,
        content: messageContent.trim(),
      });
      setMessageContent('');
      addNotification({
        kind: 'message',
        title: 'Message sent',
        body: `Shared in ${group?.name ?? 'group chat'}.`,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleAddAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !startTime || !endTime) return;

    try {
      await addAvailability.mutateAsync({
        user_id: user.id,
        start_time: startTime,
        end_time: endTime,
        timezone,
      });
      setStartTime('');
      setEndTime('');
      setShowAvailabilityForm(false);
      notify('Availability added for this group.', 'success');
      addNotification({
        kind: 'event',
        title: 'Availability shared',
        body: `Others can now see when you're free for ${group?.name ?? 'the group'}.`,
      });
    } catch (error) {
      console.error('Failed to add availability:', error);
    }
  };

  const handleGetSuggestions = async () => {
    try {
      const result = await getSuggestions.mutateAsync({
        duration_minutes: 60,
        window_days: 14,
        limit: 5,
      });
      notify(`Found ${result.data.suggestions.length} meeting suggestions.`, 'success');
      addNotification({
        kind: 'event',
        title: 'Meeting suggestions ready',
        body: `${result.data.suggestions.length} time slots surfaced for ${group?.name ?? 'your group'}.`,
      });
    } catch (error) {
      console.error('Failed to get suggestions:', error);
    }
  };

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center py-12">
            <div className="text-gray-500">Loading group...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
          {group.description && (
            <p className="mt-2 text-gray-600">{group.description}</p>
          )}
          <div className="mt-4 flex items-center gap-4">
            <div className="text-sm text-gray-500">
              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
            </div>
            {inviteLink && (
              <div className="text-sm">
                <span className="text-gray-500">Invite: </span>
                <code className="rounded bg-gray-100 px-2 py-1 text-xs">
                  {inviteLink.invite_url}
                </code>
              </div>
            )}
          </div>
        </div>
        <div className="mb-4 text-xs text-gray-500 flex flex-wrap items-center gap-1">
          <ViewTransitionLink to="/groups" className="font-semibold text-rose-500 hover:underline">
            Groups
          </ViewTransitionLink>
          <span>/</span>
          <span className="font-semibold text-gray-700">{group.name}</span>
          <span>/</span>
          <span className="text-gray-900">{activeTabLabel}</span>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('chat')}
              className={`border-b-2 pb-2 ${
                activeTab === 'chat'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`border-b-2 pb-2 ${
                activeTab === 'schedule'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`border-b-2 pb-2 ${
                activeTab === 'matches'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Group Matches
            </button>
          </nav>
        </div>

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {/* Messages */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Messages</h2>
              <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
                {messagesData?.messages.map((msg) => (
                  <div key={msg.id} className="border-b border-gray-100 pb-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-gray-900">{msg.user_id}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-gray-700">{msg.content}</p>
                  </div>
                ))}
                {(!messagesData?.messages || messagesData.messages.length === 0) && (
                  <p className="text-center text-gray-500 py-8">No messages yet</p>
                )}
              </div>

              {/* Send Message Form */}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <div className="flex-1">
                  <label htmlFor="group-message-input" className="sr-only">
                    Group message
                  </label>
                  <input
                    id="group-message-input"
                    type="text"
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="Type a message..."
                    aria-describedby="group-message-help"
                  />
                  <p id="group-message-help" className="sr-only">
                    Press enter to send your note to the group.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={postMessage.isPending}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Send
                </button>
              </form>
            </div>

            {/* Members */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Members</h2>
              <div className="space-y-2">
                {group.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{member.display_name || member.email}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            {/* Availability */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Group Availability</h2>
                <button
                  onClick={() => setShowAvailabilityForm(!showAvailabilityForm)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  {showAvailabilityForm ? 'Cancel' : 'Add Availability'}
                </button>
              </div>

              {showAvailabilityForm && (
                <form onSubmit={handleAddAvailability} className="mb-4 space-y-3 border-t pt-4">
                  <div>
                    <label htmlFor="availability-start" className="block text-sm font-medium text-gray-700">Start Time</label>
                    <input
                      id="availability-start"
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                      aria-describedby="availability-start-hint"
                    />
                    <p id="availability-start-hint" className="text-xs text-gray-500 mt-1">Local time for when you become available.</p>
                  </div>
                  <div>
                    <label htmlFor="availability-end" className="block text-sm font-medium text-gray-700">End Time</label>
                    <input
                      id="availability-end"
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                      required
                      aria-describedby="availability-end-hint"
                    />
                    <p id="availability-end-hint" className="text-xs text-gray-500 mt-1">When you&apos;re no longer free.</p>
                  </div>
                  <div>
                    <label htmlFor="availability-timezone" className="block text-sm font-medium text-gray-700">Timezone</label>
                    <input
                      id="availability-timezone"
                      type="text"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                      aria-describedby="availability-timezone-hint"
                    />
                    <p id="availability-timezone-hint" className="text-xs text-gray-500 mt-1">Example: America/New_York.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={addAvailability.isPending}
                    className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addAvailability.isPending ? 'Adding...' : 'Add Availability'}
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {availability?.map((av) => (
                  <div key={av.id} className="border-b border-gray-100 pb-2">
                    <div className="text-sm font-medium">{av.user_id}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(av.start_time).toLocaleString()} - {new Date(av.end_time).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">{av.timezone}</div>
                  </div>
                ))}
                {(!availability || availability.length === 0) && (
                  <p className="text-center text-gray-500 py-8">No availability added yet</p>
                )}
              </div>
            </div>

            {/* Meeting Suggestions */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-xl font-semibold">Meeting Suggestions</h2>
              <button
                onClick={handleGetSuggestions}
                disabled={getSuggestions.isPending}
                className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {getSuggestions.isPending ? 'Finding times...' : 'Get Meeting Suggestions'}
              </button>
              {getSuggestions.data && (
                <div className="mt-4 space-y-2">
                  {getSuggestions.data.data.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="border border-gray-200 rounded p-3">
                      <div className="text-sm font-medium">
                        {new Date(suggestion.start_time).toLocaleString()} - {new Date(suggestion.end_time).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">
                        Participants: {suggestion.participant_ids.length}
                      </div>
                      {suggestion.conflicts.length > 0 && (
                        <div className="text-xs text-orange-600">
                          Conflicts: {suggestion.conflicts.length}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          downloadCalendarFile({
                            title: `${group.name} meetup`,
                            start: suggestion.start_time,
                            end: suggestion.end_time,
                            location: group.description ?? 'Campus Center',
                            description: `Planned with ${suggestion.participant_ids.length} participants.`,
                            fileName: `${group.name}-suggestion`,
                          })
                        }
                        className="mt-3 inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-500"
                      >
                        Save to calendar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Matches Tab */}
        {activeTab === 'matches' && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Compatible Groups</h2>
            <div className="space-y-3">
              {matches?.candidates.map((candidate) => (
                <div key={candidate.group_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{candidate.group_name}</h3>
                      <div className="mt-1 text-sm text-gray-600">
                        {candidate.size} member{candidate.size !== 1 ? 's' : ''}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        {candidate.overlap_minutes} minutes of shared availability
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {candidate.compatibility_score.toFixed(0)}
                      </div>
                      <div className="text-xs text-gray-500">compatibility</div>
                    </div>
                  </div>
                </div>
              ))}
              {(!matches?.candidates || matches.candidates.length === 0) && (
                <p className="text-center text-gray-500 py-8">No compatible groups found</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
