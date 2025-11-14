"""
Calendar invite generation service for detected meetups.
Generates .ics files for calendar imports.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import re


class CalendarService:
    """Generate iCalendar (.ics) files for meetups."""

    @staticmethod
    def generate_ics(
        *,
        title: str,
        description: str,
        location: str,
        start_time: datetime,
        end_time: datetime,
        attendee_email: Optional[str] = None,
        organizer_email: Optional[str] = None,
    ) -> str:
        """
        Generate an iCalendar (.ics) format string.
        
        Args:
            title: Event title (e.g., "Coffee with Alex Chen")
            description: Event description
            location: Where the meetup is happening
            start_time: When it starts (timezone-aware datetime)
            end_time: When it ends (timezone-aware datetime)
            attendee_email: Email of the other person
            organizer_email: Email of the user creating the invite
            
        Returns:
            iCalendar format string ready to be downloaded as .ics file
        """
        # Ensure UTC timezone
        start_utc = start_time.astimezone(timezone.utc)
        end_utc = end_time.astimezone(timezone.utc)
        
        # Format timestamps for iCal (format: YYYYMMDDTHHmmssZ)
        start_str = start_utc.strftime("%Y%m%dT%H%M%SZ")
        end_str = end_utc.strftime("%Y%m%dT%H%M%SZ")
        created_str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        
        # Generate unique ID
        uid = f"{start_str}-{hash(title + location)}@campus-connect.app"
        
        # Build iCalendar content
        lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Campus Connect//Meetup Calendar//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:REQUEST",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{created_str}",
            f"DTSTART:{start_str}",
            f"DTEND:{end_str}",
            f"SUMMARY:{CalendarService._escape_ical(title)}",
            f"DESCRIPTION:{CalendarService._escape_ical(description)}",
            f"LOCATION:{CalendarService._escape_ical(location)}",
            "STATUS:CONFIRMED",
            "SEQUENCE:0",
        ]
        
        if organizer_email:
            lines.append(f"ORGANIZER:mailto:{organizer_email}")
        
        if attendee_email:
            lines.append(f"ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:{attendee_email}")
        
        lines.extend([
            "BEGIN:VALARM",
            "TRIGGER:-PT15M",
            "ACTION:DISPLAY",
            "DESCRIPTION:Reminder: Meetup in 15 minutes",
            "END:VALARM",
            "END:VEVENT",
            "END:VCALENDAR",
        ])
        
        return "\r\n".join(lines)
    
    @staticmethod
    def _escape_ical(text: str) -> str:
        """Escape special characters for iCalendar format."""
        if not text:
            return ""
        # Escape special characters
        text = text.replace("\\", "\\\\")
        text = text.replace(",", "\\,")
        text = text.replace(";", "\\;")
        text = text.replace("\n", "\\n")
        return text
    
    @staticmethod
    def extract_time_from_message(message: str) -> Optional[datetime]:
        """
        Extract time information from natural language message.
        
        Examples:
            "Let's meet at 3pm tomorrow" -> tomorrow at 3pm
            "How about Friday at 2:30?" -> Friday at 2:30pm
            "Coffee at 10am?" -> today at 10am
        """
        message_lower = message.lower()
        now = datetime.now(timezone.utc)
        
        # Pattern: "at X pm/am"
        time_pattern = r'\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b'
        time_match = re.search(time_pattern, message_lower)
        
        if not time_match:
            return None
        
        hour = int(time_match.group(1))
        minute = int(time_match.group(2)) if time_match.group(2) else 0
        period = time_match.group(3)
        
        # Convert to 24-hour format
        if period == 'pm' and hour != 12:
            hour += 12
        elif period == 'am' and hour == 12:
            hour = 0
        
        # Determine day
        target_date = now.date()
        
        if 'tomorrow' in message_lower:
            target_date = (now + timedelta(days=1)).date()
        elif 'monday' in message_lower:
            target_date = CalendarService._next_weekday(now, 0)
        elif 'tuesday' in message_lower:
            target_date = CalendarService._next_weekday(now, 1)
        elif 'wednesday' in message_lower:
            target_date = CalendarService._next_weekday(now, 2)
        elif 'thursday' in message_lower:
            target_date = CalendarService._next_weekday(now, 3)
        elif 'friday' in message_lower:
            target_date = CalendarService._next_weekday(now, 4)
        elif 'saturday' in message_lower:
            target_date = CalendarService._next_weekday(now, 5)
        elif 'sunday' in message_lower:
            target_date = CalendarService._next_weekday(now, 6)
        
        # Combine date and time
        proposed_time = datetime.combine(target_date, datetime.min.time()).replace(
            hour=hour, minute=minute, tzinfo=timezone.utc
        )
        
        # If time is in the past today, assume next day
        if proposed_time < now and 'tomorrow' not in message_lower and not any(
            day in message_lower for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        ):
            proposed_time += timedelta(days=1)
        
        return proposed_time
    
    @staticmethod
    def _next_weekday(current: datetime, target_weekday: int) -> datetime.date:
        """Get next occurrence of a weekday (0=Monday, 6=Sunday)."""
        days_ahead = target_weekday - current.weekday()
        if days_ahead <= 0:  # Target day already happened this week
            days_ahead += 7
        return (current + timedelta(days=days_ahead)).date()
    
    @staticmethod
    def extract_location_from_message(message: str) -> Optional[str]:
        """
        Extract location from message.
        
        Examples:
            "meet at Starbucks" -> "Starbucks"
            "let's go to the library" -> "the library"
            "coffee at Grounds for Thought?" -> "Grounds for Thought"
        """
        message_lower = message.lower()
        
        # Pattern: "at [location]" or "to [location]"
        location_patterns = [
            r'\bat\s+([A-Za-z0-9\s&\']+?)(?:\s+at\s+|\?|!|\.|$)',
            r'\bto\s+(?:the\s+)?([A-Za-z0-9\s&\']+?)(?:\s+at\s+|\?|!|\.|$)',
        ]
        
        for pattern in location_patterns:
            match = re.search(pattern, message, re.IGNORECASE)
            if match:
                location = match.group(1).strip()
                # Filter out time expressions
                if not re.match(r'^\d+:\d+|\d+\s*(am|pm)', location, re.IGNORECASE):
                    return location
        
        return None
    
    @staticmethod
    def detect_meetup_proposal(message: str) -> bool:
        """
        Detect if message contains a meetup/date proposal.
        
        Keywords: meet, coffee, lunch, dinner, grab, hang out, go to, etc.
        """
        message_lower = message.lower()
        
        proposal_keywords = [
            'let\'s', 'wanna', 'want to', 'how about', 'would you',
            'meet', 'coffee', 'lunch', 'dinner', 'breakfast',
            'grab', 'hang out', 'go to', 'check out',
            'study together', 'work on', 'movie', 'concert',
            'game', 'party', 'event', 'join me'
        ]
        
        return any(keyword in message_lower for keyword in proposal_keywords)
