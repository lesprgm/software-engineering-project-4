import { useEffect, useRef, useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import { DEFAULT_AVATAR } from '../lib/media';
import { useAuthStore, mapProfileToAuthUser } from '../store/auth';
import { useToast } from '../components/ToastProvider';
import { useViewNavigate } from '../hooks/useViewNavigate';
import { useBreadcrumb } from '../hooks/useBreadcrumb';
import { usersService } from '../services/users';

const INTERESTS = ['Music', 'Sports', 'Tech', 'Art', 'Gaming', 'Outdoors', 'Movies', 'Food', 'Travel'];

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const { notify } = useToast();
  const navigate = useViewNavigate();
  useBreadcrumb('Profile', { parent: '/' });
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || '');
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [pronouns, setPronouns] = useState<string>(user?.pronouns || '');
  const [location, setLocation] = useState<string>(user?.location || '');
  const [bio, setBio] = useState<string>(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.photos?.[0] || user?.avatarUrl || DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || user?.name || '');
    setInterests(user?.interests || []);
    setPronouns(user?.pronouns || '');
    setLocation(user?.location || '');
    setBio(user?.bio || '');
    setAvatarPreview(user?.photos?.[0] || user?.avatarUrl || DEFAULT_AVATAR);
  }, [user]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const onAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    try {
      setUploading(true);
      const res = await usersService.uploadPhoto(file);
      const updated = { ...(user as any), photos: res.photos, avatarUrl: res.photos?.[0] };
      setUser(updated);
      notify('Profile photo updated', 'success');
    } catch (error: any) {
      notify(error?.response?.data?.detail || 'Failed to upload photo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    try {
      setSaving(true);
      const profile = await usersService.updateProfile({
        displayName,
        interests,
        pronouns,
        location,
        bio,
      });
      setUser(mapProfileToAuthUser(profile));
      notify('Profile saved', 'success');
    } catch (error: any) {
      notify(error?.response?.data?.detail || 'Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative space-y-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_80%_at_-10%_-10%,rgba(99,102,241,0.12),transparent),radial-gradient(80%_80%_at_110%_20%,rgba(16,185,129,0.12),transparent)]" />
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img src={avatarPreview || DEFAULT_AVATAR} alt="Avatar" className="w-28 h-28 rounded-full object-cover ring-4 ring-white shadow-md" />
              <button
                type="button"
                className="absolute -bottom-2 -right-2 rounded-full bg-blue-600 text-white px-3 py-1 text-xs shadow hover:bg-blue-700"
                onClick={() => fileRef.current?.click()}
                aria-label="Change avatar"
              >
                Change
              </button>
            </div>
            <div className="text-sm text-gray-600">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              {uploading ? 'Uploading photo…' : 'PNG, JPG, or WebP · up to 5MB'}
              <button
                className="mt-3 text-xs text-gray-500 underline block"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                aria-label="Log out"
              >
                Logout
              </button>
            </div>
          </div>
        </Card>

        <Card className="md:col-span-2 p-6 space-y-6">
          <div className="space-y-4">
            <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Campus or city" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-700">Pronouns</span>
              <select className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" value={pronouns} onChange={(e) => setPronouns(e.target.value)}>
                <option value="">Select…</option>
                <option>she/her</option>
                <option>he/him</option>
                <option>they/them</option>
                <option>she/they</option>
                <option>he/they</option>
              </select>
            </label>
            <label className="text-sm block">
              <span className="mb-1 block text-gray-700">Short bio</span>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="Share how you spend weekends or ideal hangouts."
              />
            </label>
          </div>

          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">Interests</div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleInterest(tag)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    interests.includes(tag) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={onSave} loading={saving} disabled={saving}>
              Save profile
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
