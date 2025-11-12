import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/auth';
import { groupsApi } from '../services/groups';
import { useGroups } from '../hooks/useGroups';

type Message = {
  id: number | string;
  group_id: string;
  user_id?: string;
  content: string;
  created_at: string;
};

export default function Messages() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: groups, isLoading: groupsLoading } = useGroups();
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!groups?.length) return;
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
  }, [groups, searchParams, activeGroupId]);

  const messagesQ = useQuery({
    queryKey: ['group-messages', activeGroupId],
    enabled: !!activeGroupId,
    queryFn: async () => {
      const response = await groupsApi.listMessages(activeGroupId!, 100, 0);
      return response.data.messages as Message[];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQ.data]);

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
    },
  });

  const activeGroup = useMemo(
    () => groups?.find((group) => group.id === activeGroupId) || null,
    [groups, activeGroupId],
  );

  return (
    <div className="grid md:grid-cols-3 gap-4 h-[70vh]">
      <Card className="p-0 overflow-hidden">
        <div className="border-b px-4 py-2 font-semibold">Group Chats</div>
        <div className="divide-y max-h-full overflow-y-auto">
          {groups?.map((group) => (
            <button
              key={group.id}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${activeGroupId === group.id ? 'bg-blue-50' : ''}`}
              onClick={() => setActiveGroupId(group.id)}
              aria-label={`Open ${group.name} chat`}
            >
              <div className="font-medium">{group.name}</div>
            </button>
          ))}
          {!groupsLoading && !groups?.length && (
            <div className="px-4 py-6 text-sm text-gray-500">Join or create a group to start chatting.</div>
          )}
        </div>
      </Card>

      <Card className="md:col-span-2 p-0 flex flex-col">
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
      </Card>
    </div>
  );
}
