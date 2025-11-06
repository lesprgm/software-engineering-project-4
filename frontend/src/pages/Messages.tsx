import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuthStore } from '../store/auth';

type Thread = {
  id: string;
  name: string;
  lastMessageAt?: string;
};

type Message = {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
};

export default function Messages() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [searchParams] = useSearchParams();
  const threadsQ = useQuery({
    queryKey: ['threads'],
    queryFn: async () => (await api.get('/messages/threads')).data as Thread[],
  });

  useEffect(() => {
    const target = searchParams.get('with');
    if (threadsQ.data?.length) {
      if (target) {
        const match = threadsQ.data.find(t => t.name.toLowerCase() === target.toLowerCase());
        if (match) { setActiveId(match.id); return; }
      }
      if (!activeId) setActiveId(threadsQ.data[0].id);
    }
  }, [threadsQ.data, activeId, searchParams]);

  const messagesQ = useQuery({
    queryKey: ['messages', activeId],
    enabled: !!activeId,
    queryFn: async () => (await api.get(`/messages/${activeId}`)).data.messages as Message[],
    refetchInterval: 3000,
  });

  useEffect(() => {
    // Auto scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesQ.data]);

  const send = useMutation({
    mutationFn: async (content: string) => (await api.post(`/messages/${activeId}`, { content })).data,
    onSuccess: async () => {
      inputRef.current && (inputRef.current.value = '');
      await qc.invalidateQueries({ queryKey: ['messages', activeId] });
      await qc.invalidateQueries({ queryKey: ['threads'] });
    },
  });

  const activeThread = useMemo(() => threadsQ.data?.find(t => t.id === activeId) || null, [threadsQ.data, activeId]);

  return (
    <div className="grid md:grid-cols-3 gap-4 h-[70vh]">
      <Card className="p-0 overflow-hidden">
        <div className="border-b px-4 py-2 font-semibold">Messages</div>
        <div className="divide-y max-h-full overflow-y-auto">
          {threadsQ.data?.map((t) => (
            <button
              key={t.id}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${activeId === t.id ? 'bg-blue-50' : ''}`}
              onClick={() => setActiveId(t.id)}
              aria-label={`Open thread ${t.name}`}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>
                {t.lastMessageAt && (
                  <div className="text-xs text-gray-500">{new Date(t.lastMessageAt).toLocaleTimeString()}</div>
                )}
              </div>
            </button>
          ))}
          {!threadsQ.data?.length && (
            <div className="px-4 py-6 text-sm text-gray-500">No conversations yet.</div>
          )}
        </div>
      </Card>

      <Card className="md:col-span-2 p-0 flex flex-col">
        <div className="border-b px-4 py-2 font-semibold">
          {activeThread ? activeThread.name : 'Select a conversation'}
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
          {messagesQ.data?.map((m) => {
            const mine = m.senderId === me?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow ${mine ? 'bg-blue-600 text-white' : 'bg-white'}`}>
                  {!mine && <div className="text-xs font-semibold text-gray-500 mb-0.5">{m.senderName}</div>}
                  <div>{m.content}</div>
                  <div className={`text-[10px] mt-1 ${mine ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(m.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            );
          })}
          {!messagesQ.data?.length && activeThread && (
            <div className="text-sm text-gray-500">No messages yet. Say hello!</div>
          )}
        </div>
        <form
          className="border-t p-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!activeId) return;
            const value = inputRef.current?.value?.trim();
            if (!value) return;
            send.mutate(value);
          }}
        >
          <input ref={inputRef} aria-label="Type a message" className="flex-1 rounded-md border border-gray-300 px-3 py-2" placeholder="Type a message" />
          <Button type="submit" disabled={!activeId} loading={send.isPending}>Send</Button>
        </form>
      </Card>
    </div>
  );
}
