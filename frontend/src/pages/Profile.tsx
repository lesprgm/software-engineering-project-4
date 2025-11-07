import { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import api from '../lib/api';
import { DEFAULT_AVATAR } from '../lib/media';
import { useAuthStore } from '../store/auth';
import { useToast } from '../components/ToastProvider';
import { useNavigate } from 'react-router-dom';

const INTERESTS = ['Music', 'Sports', 'Tech', 'Art', 'Gaming', 'Outdoors', 'Movies', 'Food', 'Travel'];

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const { notify } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  // New dating-profile fields
  const [pronouns, setPronouns] = useState<string>((user as any)?.pronouns || '');
  const [major, setMajor] = useState<string>((user as any)?.major || '');
  const [classYear, setClassYear] = useState<string>((user as any)?.classYear || '');
  const [birthday, setBirthday] = useState<string>((user as any)?.birthday || '');
  const [bio, setBio] = useState<string>((user as any)?.bio || '');
  const [goals, setGoals] = useState<string[]>((user as any)?.goals || []); // e.g., friendship, study, dating

  useEffect(() => {
    setName(user?.name || '');
    setInterests(user?.interests || []);
    setAvatarPreview(user?.avatarUrl);
    setPronouns((user as any)?.pronouns || '');
    setMajor((user as any)?.major || '');
    setClassYear((user as any)?.classYear || '');
    setBirthday((user as any)?.birthday || '');
    setBio((user as any)?.bio || '');
    setGoals((user as any)?.goals || []);
  }, [user]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...(user as any), avatarUrl: res.data.url });
      notify('Profile photo updated', 'success');
    } catch (err: any) {
      notify(err?.response?.data?.detail || 'Failed to upload photo', 'error');
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const res = await api.put('/users/me', {
        name,
        interests,
        pronouns,
        major,
        classYear,
        birthday,
        bio,
        goals,
        privacy: { showProfile: true },
      });
      setUser(res.data as any);
      notify('Profile saved', 'success');
    } catch (err: any) {
      notify(err?.response?.data?.detail || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      {/* full-bleed soft gradient */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_80%_at_-10%_-10%,rgba(99,102,241,0.12),transparent),radial-gradient(80%_80%_at_110%_20%,rgba(16,185,129,0.12),transparent)]" />

      <div className="grid md:grid-cols-3 gap-6">
        {/* Avatar + actions */}
        <Card className="md:col-span-1 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={avatarPreview || DEFAULT_AVATAR}
                alt="Avatar"
                className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-md"
              />
              <button
                type="button"
                className="absolute -bottom-2 -right-2 rounded-full bg-blue-600 text-white px-3 py-1 text-xs shadow hover:bg-blue-700"
                onClick={() => fileRef.current?.click()}
                aria-label="Change avatar"
              >
                Change
              </button>
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              <div className="text-sm text-gray-600">PNG or JPG, up to 2MB</div>
              <button
                className="mt-3 text-sm text-gray-500 underline"
                onClick={() => { logout(); navigate('/login'); }}
                aria-label="Log out"
              >
                Logout
              </button>
            </div>
          </div>
        </Card>

        {/* Profile form */}
        <Card className="md:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Profile</h2>
            {/* completeness */}
            {(() => {
              const checks = [
                !!avatarPreview,
                !!name,
                !!pronouns,
                !!major,
                !!classYear,
                !!birthday,
                bio.trim().length >= 40,
                (interests?.length || 0) >= 3,
              ];
              const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
              return (
                <div className="hidden md:flex items-center gap-3 text-sm text-gray-600">
                  <span>Completeness</span>
                  <div className="w-40 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="tabular-nums">{pct}%</span>
                </div>
              );
            })()}
          </div>
          <div className="space-y-6">
            <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />

            <div className="grid md:grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Pronouns</span>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={pronouns}
                  onChange={(e) => setPronouns(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>she/her</option>
                  <option>he/him</option>
                  <option>they/them</option>
                  <option>she/they</option>
                  <option>he/they</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Birthday</span>
                <input
                  type="date"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                />
              </label>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Major" value={major} onChange={(e) => setMajor(e.target.value)} />
              <label className="text-sm">
                <span className="mb-1 block text-gray-700">Class year</span>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={classYear}
                  onChange={(e) => setClassYear(e.target.value)}
                >
                  <option value="">Select…</option>
                  <option>Freshman</option>
                  <option>Sophomore</option>
                  <option>Junior</option>
                  <option>Senior</option>
                  <option>Graduate</option>
                </select>
              </label>
            </div>

            <div>
              <div className="mb-2 text-sm text-gray-700">Interests</div>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((tag) => {
                  const active = interests.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white/80 text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => toggleInterest(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm text-gray-700">What I'm looking for</div>
              <div className="flex flex-wrap gap-2">
                {['Friendship', 'Hangouts', 'Study buddy', 'Dating', 'Serious'].map((g) => {
                  const active = goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white/80 text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setGoals((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="text-sm block">
              <span className="mb-1 block text-gray-700">About me</span>
              <textarea
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
                placeholder="Two truths, hobbies, campus favorites…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>

            <div className="flex gap-2">
              <Button onClick={onSave} loading={saving} aria-label="Save profile">Save</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
