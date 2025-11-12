import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { groupsApi } from '../services/groups';
import { useGroups, useUserMatches } from '../hooks/useGroups';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { directMessagesService } from '../services/directMessages';

type Message = {
  id: number | string;
  group_id: string;
  user_id?: string;
  content: string;
  created_at: string;
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
  const { data: matches } = useUserMatches(me?.id);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeDirectId, setActiveDirectId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>('groups');

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
      return response.data.messages as Message[];
    },
    refetchInterval: 5000,
  });

  const directMessagesQ = useQuery({
    queryKey: ['direct-messages', activeDirectId],
    enabled: !!activeDirectId && mode === 'direct',
    queryFn: async () => {
      const messages = await directMessagesService.list(activeDirectId!, 100);
      return messages;
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQ.data]);

  useEffect(() => {
    if (directScrollRef.current) {
      directScrollRef.current.scrollTop = directScrollRef.current.scrollHeight;
    }
  }, [directMessagesQ.data]);

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

  const sendDirect = useMutation({
    mutationFn: async (content: string) => {
      if (!activeDirectId) throw new Error('Missing direct recipient');
      return directMessagesService.send(activeDirectId, content);
    },
    onSuccess: async () => {
      directInputRef.current && (directInputRef.current.value = '');
      await qc.invalidateQueries({ queryKey: ['direct-messages', activeDirectId] });
      if (activeDirect) {
        addNotification({
          kind: 'message',
          title: 'Message sent',
          body: `Shared with ${activeDirect.display_name || 'match'}.`,
        });
      }
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
              <div ref={directScrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {directMessagesQ.data?.map((message) => {
                  const mine = message.senderId === me?.id;
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow ${mine ? 'bg-purple-600 text-white' : 'bg-white'}`}>
                        {!mine && (
                          <div className="text-xs font-semibold text-gray-500 mb-0.5">
                            {activeDirect?.display_name || 'Match'}
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
                {!directMessagesQ.data?.length && activeDirect && (
                  <div className="text-sm text-gray-500">No messages yet. Break the ice!</div>
                )}
                {!activeDirect && <div className="text-sm text-gray-500">Pick a match to start chatting.</div>}
              </div>
              {activeDirect ? (
                <form
                  className="border-t p-3 flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = directInputRef.current?.value?.trim();
                    if (!value || !activeDirectId) return;
                    sendDirect.mutate(value);
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
