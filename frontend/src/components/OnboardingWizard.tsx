import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useOnboardingStore } from '../store/onboarding';
import Button from './ui/Button';

const INTEREST_OPTIONS = ['Live music', 'Coffee chats', 'Board games', 'Hack nights', 'Wellness walks', 'Study dates'];
const AVAILABILITY_OPTIONS = [
  { label: 'Weekday evenings', value: 'weekday-evening' },
  { label: 'Weekend mornings', value: 'weekend-morning' },
  { label: 'Late night', value: 'late-night' },
];
const NOTIFICATION_OPTIONS = [
  { label: 'In-app toasts', value: 'toasts' },
  { label: 'Email summaries', value: 'email' },
  { label: 'Keep it quiet', value: 'silent' },
];

export default function OnboardingWizard() {
  const token = useAuthStore((s) => s.token);
  const {
    completed,
    interests,
    availability,
    notificationPreference,
    toggleInterest,
    setAvailability,
    setNotificationPreference,
    complete,
    skip,
  } = useOnboardingStore();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!token || completed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [completed, token]);

  if (completed || !token) return null;

  const advance = () => {
    if (step < 2) setStep((value) => value + 1);
    else complete();
  };

  const regress = () => setStep((value) => Math.max(0, value - 1));

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <p className="text-sm text-gray-600 mb-3">Choose a few things you&apos;d happily do with someone new.</p>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((option) => {
                const active = interests.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => toggleInterest(option)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      active ? 'bg-rose-50 border-rose-400 text-rose-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    aria-pressed={active}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 1:
        return (
          <div>
            <p className="text-sm text-gray-600 mb-3">When do you usually have time to hang?</p>
            <div className="space-y-2">
              {AVAILABILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 cursor-pointer ${
                    availability === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="availability"
                    value={option.value}
                    checked={availability === option.value}
                    onChange={() => setAvailability(option.value)}
                  />
                  <span className="text-sm text-gray-800">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div>
            <p className="text-sm text-gray-600 mb-3">How should we nudge you about new matches and plans?</p>
            <div className="space-y-2">
              {NOTIFICATION_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2 cursor-pointer ${
                    notificationPreference === option.value ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="notificationPref"
                    value={option.value}
                    checked={notificationPreference === option.value}
                    onChange={() => setNotificationPreference(option.value as 'toasts' | 'email' | 'silent')}
                  />
                  <span className="text-sm text-gray-800">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const progress = ((step + 1) / 3) * 100;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden />
      <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl animate-pop">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-semibold text-rose-600">Quick setup</div>
            <div className="text-lg font-bold text-gray-900">Let&apos;s personalize your feed</div>
          </div>
          <button type="button" onClick={skip} className="text-sm text-gray-500 hover:text-gray-700">
            Skip
          </button>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-4">
          <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress}%` }} aria-hidden />
        </div>
        {renderStep()}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="secondary" onClick={regress} disabled={step === 0}>
            Back
          </Button>
          <Button onClick={advance}>
            {step === 2 ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
