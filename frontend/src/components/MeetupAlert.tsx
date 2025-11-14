import { useState } from 'react';
import Button from './ui/Button';
import { calendarApi, CalendarInviteRequest } from '../services/calendar';
import { useToast } from './ToastProvider';

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface MeetupAlertProps {
  message: string;
  partnerName: string;
  partnerEmail?: string;
  onDismiss: () => void;
}

export default function MeetupAlert({ message, partnerName, partnerEmail, onDismiss }: MeetupAlertProps) {
  const { notify } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [location, setLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [notes, setNotes] = useState('');
  const [detecting, setDetecting] = useState(true);
  const [detectionData, setDetectionData] = useState<{
    location?: string;
    proposed_time?: string;
    suggestion?: string;
  } | null>(null);

  // Auto-detect on mount
  useState(() => {
    calendarApi
      .detectMeetup(message)
      .then((response) => {
        if (response.data.is_meetup) {
          setDetectionData({
            location: response.data.location || undefined,
            proposed_time: response.data.proposed_time || undefined,
            suggestion: response.data.suggestion || undefined,
          });
          setLocation(response.data.location || '');
          // Convert to local timezone for datetime-local input
          if (response.data.proposed_time) {
            try {
              const date = new Date(response.data.proposed_time);
              if (!isNaN(date.getTime())) {
                const localDateTime = formatDateTimeLocal(date);
                setStartTime(localDateTime);
              }
            } catch (e) {
              console.error('Error parsing proposed time:', e);
            }
          }
        } else {
          onDismiss(); // Not a meetup, dismiss alert
        }
      })
      .catch(() => {
        onDismiss();
      })
      .finally(() => {
        setDetecting(false);
      });
  });

  const handleAddToCalendar = () => {
    setShowConfirm(true);
  };

  const handleConfirmAndDownload = async () => {
    if (!location.trim() || !startTime) {
      notify('Please fill in location and time', 'error');
      return;
    }

    try {
      const request: CalendarInviteRequest = {
        partner_name: partnerName,
        partner_email: partnerEmail,
        location: location.trim(),
        start_time: new Date(startTime).toISOString(),
        duration_minutes: 60,
        notes: notes.trim() || undefined,
      };

      // Get the blob response
      const response = await calendarApi.downloadInvite(request);
      
      // Create a download link
      const blob = new Blob([response.data], { type: 'text/calendar' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `meetup_${partnerName.replace(/\s+/g, '_')}_${formatDateForFilename(new Date(startTime))}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      notify('Calendar invite downloaded! Check your downloads folder.', 'success');
      onDismiss();
    } catch (error) {
      console.error('Failed to generate calendar invite:', error);
      notify('Failed to create calendar invite', 'error');
    }
  };

  if (detecting) {
    return (
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <span className="text-sm text-blue-800">Analyzing message...</span>
        </div>
      </div>
    );
  }

  if (!detectionData) {
    return null;
  }

  return (
    <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4 space-y-3 animate-pop">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-purple-600 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <div>
            <div className="font-semibold text-purple-900">Potential Meetup Detected!</div>
            <div className="text-sm text-purple-700">
              {detectionData.suggestion || 'Would you like to add this to your calendar?'}
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-purple-400 hover:text-purple-600 transition"
          aria-label="Dismiss"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!showConfirm ? (
                <div className="flex gap-2 mt-4">
          <Button onClick={handleAddToCalendar} className="text-sm py-1 px-3">
            Add to Calendar
          </Button>
          <Button variant="secondary" onClick={onDismiss} className="text-sm py-1 px-3">
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-purple-200">
          <div>
            <label className="block text-xs font-medium text-purple-900 mb-1">
              Location {location ? '✓' : '*'}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Starbucks on Main St"
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-900 mb-1">
              Date & Time {startTime ? '✓' : '*'}
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
              placeholder="Select date and time"
              title="Select the date and time for the meetup"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-900 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="w-full rounded-md border border-purple-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleConfirmAndDownload} disabled={!location.trim() || !startTime} className="text-sm py-1 px-3">
              Download Invite
            </Button>
            <Button variant="secondary" onClick={() => setShowConfirm(false)} className="text-sm py-1 px-3">
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
