import Button from '../components/ui/Button';
import { useViewNavigate } from '../hooks/useViewNavigate';
import { useBreadcrumb } from '../hooks/useBreadcrumb';

export default function Choose() {
  const navigate = useViewNavigate();
  useBreadcrumb('Home');

  const go = (type: 'user' | 'group') => {
    navigate(`/matches?type=${type}`);
  };

  return (
  <section className="w-full bg-transparent py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 md:px-6 min-h-[75vh] flex items-center justify-center">
        <div className="w-full grid md:grid-cols-2 gap-12 md:gap-16 place-items-center text-center">
          {/* One-to-one */}
          <div className="group flex flex-col items-center text-center px-8 py-10 rounded-2xl bg-transparent backdrop-blur-md border border-white/10">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-rose-400 text-white shadow-2xl shadow-rose-500/25">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 14a4 4 0 00-8 0v1a3 3 0 003 3h2a3 3 0 003-3v-1z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-rose-600 to-rose-500 bg-clip-text text-transparent">One-to-one</span>
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl">
              Find individuals to hang out, study, or date. Personalized matches for easy one‑on‑one connections.
            </p>
            <Button className="mt-8 px-7 py-3.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white" onClick={() => go('user')} aria-label="Choose one-to-one">
              Start 1:1
            </Button>
          </div>

          {/* Group */}
          <div className="group flex flex-col items-center text-center px-8 py-10 rounded-2xl bg-transparent backdrop-blur-md border border-white/10">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-pink-300 text-white shadow-2xl shadow-pink-400/25">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20H4v-2a4 4 0 014-4h1" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
            </div>
            <h2 className="mt-6 text-4xl md:text-5xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-pink-500 to-pink-300 bg-clip-text text-transparent">Group Hangout</span>
            </h2>
            <p className="mt-4 text-gray-600 max-w-xl">
              Discover groups for events, games, and meetups. Great for hosting or joining group activities on campus.
            </p>
            <Button variant="secondary" className="mt-8 px-7 py-3.5 rounded-full bg-pink-50 text-pink-600 hover:bg-pink-100" onClick={() => go('group')} aria-label="Choose group hangout">
              See Groups
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
