import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { groupsApi } from '../services/groups';
import { useGroups, useRightSwipes } from '../hooks/useGroups';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { aiApi } from '../services/ai';
import MeetupAlert from '../components/MeetupAlert';

type GroupMessage = {
  id: number | string;
  group_id: string;
  user_id?: string;
  content: string;
  created_at: string;
};

type DirectEntry = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  role?: 'system';
};

type ViewMode = 'groups' | 'direct';

export default function Messages() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { addNotification } = useNotifications();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const directInputRef = useRef<HTMLInputElement>(null);
  const directScrollRef = useRef<HTMLDivElement>(null);
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const { data: matches } = useRightSwipes(me?.id);  // Show anyone you swiped right on (demo mode)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeDirectId, setActiveDirectId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('groups');
  const [meetupAlert, setMeetupAlert] = useState<{
    message: string;
    partnerName: string;
    partnerEmail?: string;
  } | null>(null);

  const [searchParams] = useSearchParams();
  useBreadcrumb('Messages', { parent: '/' });

  useEffect(() => {
    if (!groups?.length || mode !== 'groups') return;
    const target = searchParams.get('group');
    if (target) {
      const found = groups.find((group) => group.id === target);
      if (found) {
        setActiveGroupId(found.id);
        return;
      }
    }
    if (!activeGroupId) {
      setActiveGroupId(groups[0].id);
    }
  }, [groups, searchParams, activeGroupId, mode]);

  useEffect(() => {
    if (mode !== 'direct' || !matches?.length) return;
    if (!activeDirectId) {
      setActiveDirectId(matches[0].user_id);
    }
  }, [matches, mode, activeDirectId]);

  const messagesQ = useQuery({
    queryKey: ['group-messages', activeGroupId],
    enabled: !!activeGroupId && mode === 'groups',
    queryFn: async () => {
      const response = await groupsApi.listMessages(activeGroupId!, 100, 0);
      return response.data.messages as GroupMessage[];
    },
    refetchInterval: 5000,
  });

  const [directThreads, setDirectThreads] = useState<Record<string, DirectEntry[]>>({});
  const [aiTyping, setAiTyping] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQ.data]);

  useEffect(() => {
    if (directScrollRef.current) {
      directScrollRef.current.scrollTop = directScrollRef.current.scrollHeight;
    }
  }, [directThreads, activeDirectId]);

  const send = useMutation({
    mutationFn: async (content: string) => {
      if (!me?.id || !activeGroupId) {
        throw new Error('Missing user or group');
      }
      return groupsApi.postMessage(activeGroupId, { user_id: me.id, content });
    },
    onSuccess: async () => {
      inputRef.current && (inputRef.current.value = '');
      await qc.invalidateQueries({ queryKey: ['group-messages', activeGroupId] });
      const groupName = groups?.find((group) => group.id === activeGroupId)?.name || 'group chat';
      addNotification({
        kind: 'message',
        title: 'Message sent',
        body: `Shared in ${groupName}.`,
      });
    },
  });

  const activeGroup = useMemo(
    () => (mode === 'groups' ? groups?.find((group) => group.id === activeGroupId) || null : null),
    [groups, activeGroupId, mode],
  );

  const activeDirect = useMemo(
    () => (mode === 'direct' ? matches?.find((candidate) => candidate.user_id === activeDirectId) || null : null),
    [matches, activeDirectId, mode],
  );

  const directMessages = useMemo(() => {
    if (!activeDirectId) return [] as DirectEntry[];
    return directThreads[activeDirectId] || [];
  }, [directThreads, activeDirectId]);
  const isAiResponding = activeDirectId ? !!aiTyping[activeDirectId] : false;

  useEffect(() => {
    if (!activeDirectId || !activeDirect) return;
    setDirectThreads((prev) => {
      if (prev[activeDirectId]) return prev;
      const introLine = activeDirect.tagline
        ? `${activeDirect.tagline} (powered by Gemini).`
        : "I'm powered by Gemini, so feel free to bounce ideas off me.";
      const intro: DirectEntry = {
        id: `${activeDirectId}-intro`,
        senderId: activeDirectId,
        content: `Hey! I'm ${activeDirect.display_name}. ${introLine}`,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, [activeDirectId]: [intro] };
    });
  }, [activeDirectId, activeDirect]);

  const appendDirectEntry = (partnerId: string, entry: DirectEntry) => {
    setDirectThreads((prev) => {
      const history = prev[partnerId] ?? [];
      return { ...prev, [partnerId]: [...history, entry] };
    });
  };

  const sendDirect = useMutation({
    mutationFn: async (variables: { partnerId: string; partnerName: string; message: string }) => {
      if (!me?.id) {
        throw new Error('You need to be logged in to chat.');
      }
      return aiApi.sendDirectMessage({
        user_name: me.displayName || me.name || 'You',
        partner_name: variables.partnerName || 'Gemini',
        message: variables.message,
        partner_id: variables.partnerId,
      });
    },
    onMutate: (variables) => {
      if (!me?.id) return;
      const entry: DirectEntry = {
        id: `user-${variables.partnerId}-${Date.now()}`,
        senderId: me.id,
        content: variables.message,
        createdAt: new Date().toISOString(),
      };
      appendDirectEntry(variables.partnerId, entry);
      setAiTyping((prev) => ({ ...prev, [variables.partnerId]: true }));
      
      // Show meetup alert for potential date proposals
      setMeetupAlert({
        message: variables.message,
        partnerName: variables.partnerName,
        partnerEmail: undefined, // Can be added if needed
      });
      
      if (directInputRef.current) {
        directInputRef.current.value = '';
      }
    },
    onSuccess: (response, variables) => {
      const reply = response.data.reply_text || 'Thinking...';
      const entry: DirectEntry = {
        id: `ai-${variables.partnerId}-${Date.now()}`,
        senderId: variables.partnerId,
        content: reply,
        createdAt: new Date().toISOString(),
      };
      appendDirectEntry(variables.partnerId, entry);
      addNotification({
        kind: 'message',
        title: 'Gemini replied',
        body: `Shared with ${variables.partnerName || 'your match'}.`,
      });
    },
    onError: (_error, variables) => {
      const partnerId = variables?.partnerId;
      if (partnerId) {
        appendDirectEntry(partnerId, {
          id: `system-${partnerId}-${Date.now()}`,
          senderId: partnerId,
          role: 'system',
          content: 'We could not reach Gemini. Try again in a moment.',
          createdAt: new Date().toISOString(),
        });
      }
      addNotification({
        kind: 'error',
        title: 'Message failed',
        body: 'Gemini could not reply. Please try again.',
      });
    },
    onSettled: (_data, _error, variables) => {
      if (!variables) return;
      setAiTyping((prev) => {
        const next = { ...prev };
        delete next[variables.partnerId];
        return next;
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant={mode === 'groups' ? 'primary' : 'secondary'} onClick={() => setMode('groups')}>
          Group chats
        </Button>
        <Button variant={mode === 'direct' ? 'primary' : 'secondary'} onClick={() => setMode('direct')}>
          Direct messages
        </Button>
      </div>
      <div className="grid md:grid-cols-3 gap-4 h-[65vh]">
        <Card className="p-0 overflow-hidden">
          <div className="border-b px-4 py-2 font-semibold">
            {mode === 'groups' ? 'Group Chats' : 'Matches'}
          </div>
          <div className="divide-y max-h-full overflow-y-auto">
            {mode === 'groups' &&
              groups?.map((group) => (
                <button
                  key={group.id}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${activeGroupId === group.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setActiveGroupId(group.id)}
                  aria-label={`Open ${group.name} chat`}
                >
                  <div className="font-medium">{group.name}</div>
                </button>
              ))}
            {mode === 'direct' &&
              matches?.map((candidate) => (
                <button
                  key={candidate.user_id}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${activeDirectId === candidate.user_id ? 'bg-blue-50' : ''}`}
                  onClick={() => setActiveDirectId(candidate.user_id)}
                  aria-label={`Open chat with ${candidate.display_name}`}
                >
                  <div className="font-medium">{candidate.display_name}</div>
                  {candidate.tagline && (
                    <div className="text-xs text-gray-500">{candidate.tagline}</div>
                  )}
                  <div className="text-xs text-gray-500">Compatibility {(candidate.compatibility_score * 100).toFixed(0)}%</div>
                </button>
              ))}
            {mode === 'groups' && !groupsLoading && !groups?.length && (
              <div className="px-4 py-6 text-sm text-gray-500">Join or create a group to start chatting.</div>
            )}
            {mode === 'direct' && (!matches || matches.length === 0) && (
              <div className="px-4 py-6 text-sm text-gray-500">No matches yet. Explore Matches to start a conversation.</div>
            )}
          </div>
        </Card>

        <Card className="md:col-span-2 p-0 flex flex-col">
          {mode === 'groups' ? (
            <>
              <div className="border-b px-4 py-2 font-semibold">
                {activeGroup ? activeGroup.name : 'Select a group conversation'}
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {messagesQ.data?.map((message) => {
                  const mine = message.user_id === me?.id;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow ${mine ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                        {!mine && (
                          <div className="text-xs font-semibold text-gray-500 mb-0.5">
                            {message.user_id || 'Member'}
                          </div>
                        )}
                        <div>{message.content}</div>
                        <div className={`text-[10px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>
                          {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!messagesQ.data?.length && activeGroup && (
                  <div className="text-sm text-gray-500">No messages yet. Say hello!</div>
                )}
                {!activeGroup && (
                  <div className="text-sm text-gray-500">Pick a group chat to read the conversation.</div>
                )}
              </div>
              <form
                className="border-t p-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!activeGroupId) return;
                  const value = inputRef.current?.value?.trim();
                  if (!value) return;
                  send.mutate(value);
                }}
              >
                <input ref={inputRef} aria-label="Type a message" className="flex-1 rounded-md border border-gray-300 px-3 py-2" placeholder="Type a message" />
                <Button type="submit" disabled={!activeGroupId || send.isPending || !me?.id} loading={send.isPending}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="border-b px-4 py-2 font-semibold">
                {activeDirect ? activeDirect.display_name : 'Select a match'}
              </div>
              {meetupAlert && (
                <div className="px-4 pt-4">
                  <MeetupAlert
                    message={meetupAlert.message}
                    partnerName={meetupAlert.partnerName}
                    partnerEmail={meetupAlert.partnerEmail}
                    onDismiss={() => setMeetupAlert(null)}
                  />
                </div>
              )}
              <div ref={directScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {directMessages.map((message) => {
                  const mine = message.senderId === me?.id;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow ${mine ? 'bg-purple-600 text-white' : 'bg-white'}`}>
                        {!mine && (
                          <div className="text-xs font-semibold text-gray-500 mb-0.5">
                            {message.role === 'system' ? 'System' : activeDirect?.display_name || 'Gemini'}
                          </div>
                        )}
                        <div>{message.content}</div>
                        <div className={`text-[10px] mt-1 ${mine ? 'text-purple-100' : 'text-gray-400'}`}>
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {!directMessages.length && activeDirect && (
                  <div className="text-sm text-gray-500">No messages yet. Break the ice!</div>
                )}
                {isAiResponding && (
                  <div className="flex justify-start">
                    <div className="max-w-[70%] rounded-lg px-3 py-2 text-sm shadow bg-white text-gray-700 italic opacity-80">
                      {activeDirect?.display_name || 'Gemini'} is crafting a reply…
                    </div>
                  </div>
                )}
                {!activeDirect && <div className="text-sm text-gray-500">Pick a match to start chatting.</div>}
              </div>
              {activeDirect ? (
                <form
                  className="border-t p-3 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = directInputRef.current?.value?.trim();
                    if (!value || !activeDirectId || !activeDirect) return;
                    if (!me?.id) {
                      addNotification({
                        kind: 'error',
                        title: 'Login required',
                        body: 'Sign in to chat with Gemini.',
                      });
                      return;
                    }
                    sendDirect.mutate({
                      partnerId: activeDirectId,
                      partnerName: activeDirect.display_name || 'Gemini',
                      message: value,
                    });
                  }}
                >
                  <input
                    ref={directInputRef}
                    aria-label="Type a direct message"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2"
                    placeholder={`Message ${activeDirect.display_name}`}
                    disabled={sendDirect.isPending}
                  />
                  <Button type="submit" disabled={!activeDirectId || sendDirect.isPending} loading={sendDirect.isPending}>
                    Send
                  </Button>
                </form>
              ) : (
                <div className="border-t p-3 text-sm text-gray-500">Select a match from the list to start messaging.</div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
