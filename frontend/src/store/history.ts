import { create } from 'zustand';

export type HistoryAction<T = any> = {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
};

type HistoryState = {
  past: HistoryAction[];
  future: HistoryAction[];
  push: (action: Omit<HistoryAction, 'timestamp'> & { timestamp?: number }) => void;
  undo: () => HistoryAction | null;
  redo: () => HistoryAction | null;
  clear: () => void;
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  push: (action) =>
    set((state) => ({
      past: [...state.past, { ...action, timestamp: action.timestamp ?? Date.now() }],
      future: [],
    })),
  undo: () => {
    const { past, future } = get();
    if (!past.length) return null;
    const nextPast = past.slice(0, -1);
    const last = past[past.length - 1];
    set({ past: nextPast, future: [last, ...future] });
    return last;
  },
  redo: () => {
    const { past, future } = get();
    if (!future.length) return null;
    const [first, ...rest] = future;
    set({ past: [...past, first], future: rest });
    return first;
  },
  clear: () => set({ past: [], future: [] }),
}));
