"""
Seed the database with 15 diverse sample users for matching demo.
Each user has unique personality, interests, and availability patterns.
"""
from pathlib import Path
import sys
import hashlib
import shutil
from datetime import datetime, timezone

sys.path.append(str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.models.user import User

BASE_DIR = Path(__file__).resolve().parents[2]
USER_IMAGE_DIR = BASE_DIR / "userimages"
UPLOADS_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

USER_IMAGE_MAP = {
    "alex.chen@college.edu": "Alex.jpg",
    "maya.patel@college.edu": "Maya.jpg",
    "jordan.kim@college.edu": "Jordan.jpg",
    "marcus.williams@college.edu": "Marcus.jpg",
    "sophie.rousseau@college.edu": "Sophie.jpg",
    "tyler.johnson@college.edu": "Tyler.jpg",
    "priya.sharma@college.edu": "Priya.jpg",
    "ethan.moore@college.edu": "Ethan.jpg",
    "zara.okonkwo@college.edu": "Zara.jpg",
    "liam.otoole@college.edu": "Liam.jpg",
    "nina.volkov@college.edu": "Nina.jpg",
    "carlos.rivera@college.edu": "Carlos.jpg",
    "hannah.goldstein@college.edu": "Hannah.jpg",
    "jamal.washington@college.edu": "Jamal.jpg",
    "lily.nguyen@college.edu": "Lily.jpg",
}


def _slugify(value: str) -> str:
    cleaned = [ch.lower() if ch.isalnum() else "-" for ch in value]
    slug = "".join(cleaned)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-") or "user-image"


def ensure_local_photo(email: str, display_name: str) -> str | None:
    """Copy the matching photo into uploads and return relative URL if available."""
    filename = USER_IMAGE_MAP.get(email.lower())
    if not filename:
        return None
    source = USER_IMAGE_DIR / filename
    if not source.exists():
        return None

    dest_name = f"{_slugify(display_name)}{source.suffix.lower()}"
    dest_path = UPLOADS_DIR / dest_name
    try:
        if not dest_path.exists() or source.stat().st_mtime > dest_path.stat().st_mtime:
            shutil.copyfile(source, dest_path)
    except OSError as error:
        print(f"⚠️  Unable to copy photo for {display_name}: {error}")
        return None
    return f"/uploads/{dest_name}"

def hash_password(password: str) -> str:
    """Hash password using SHA256 to match UserService._hash_password"""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

db = SessionLocal()

# 15 diverse sample users with rich personalities for matching
sample_users = [
    {
        "email": "alex.chen@college.edu",
        "password": "demo123",
        "display_name": "Alex Chen",
        "bio": "Computer Science major who loves building side projects and exploring new tech. Always down for hackathons, study sessions, or late-night debugging marathons. Coffee enthusiast and mechanical keyboard collector.",
        "interests": ["coding", "hackathons", "coffee", "mechanical keyboards", "AI/ML", "open source"],
        "pronouns": "they/them",
        "location": "Andrews Hall",
        "personality": "Analytical problem-solver with a dry sense of humor. Loves explaining complex concepts in simple terms. Gets excited about elegant code and efficient algorithms. Night owl who does their best work after 10 PM.",
    },
    {
        "email": "maya.patel@college.edu",
        "password": "demo123",
        "display_name": "Maya Patel",
        "bio": "Pre-med biology major passionate about global health equity. President of the Community Health Outreach club. Love hiking, yoga, and finding the best bubble tea spots around campus.",
        "interests": ["biology", "global health", "hiking", "yoga", "bubble tea", "volunteering"],
        "pronouns": "she/her",
        "location": "Holden Hall",
        "personality": "Warm and empathetic with infectious enthusiasm. Natural leader who brings people together. Early riser who plans their weeks meticulously. Balances ambition with genuine care for others' wellbeing.",
    },
    {
        "email": "jordan.kim@college.edu",
        "password": "demo123",
        "display_name": "Jordan Kim",
        "bio": "Studio art major specializing in digital illustration. Runs a small print shop on Etsy. Obsessed with anime, K-pop, and indie games. Looking for people to explore new restaurants and art galleries with!",
        "interests": ["digital art", "anime", "K-pop", "indie games", "printmaking", "illustration"],
        "pronouns": "she/her",
        "location": "Babcock Hall",
        "personality": "Creative and spontaneous with an eye for aesthetics. Shares memes constantly and has playlists for every mood. Procrastinates with purpose then pulls all-nighters to create amazing work. Always discovering new artists.",
    },
    {
        "email": "marcus.williams@college.edu",
        "password": "demo123",
        "display_name": "Marcus Williams",
        "bio": "Economics major and varsity basketball player. Love analyzing sports stats, playing pickup games, and debating economic policy. Trying to visit every national park before graduation.",
        "interests": ["basketball", "economics", "national parks", "sports analytics", "hiking", "podcasts"],
        "pronouns": "he/him",
        "location": "Armington Hall",
        "personality": "Competitive but friendly with natural charisma. Motivates others through leading by example. Morning person who starts days with a 6 AM run. Brings snacks to study groups and remembers everyone's names.",
    },
    {
        "email": "sophie.rousseau@college.edu",
        "password": "demo123",
        "display_name": "Sophie Rousseau",
        "bio": "Philosophy and French double major. Love existentialist literature, arthouse films, and deep 2 AM conversations. Looking for a French conversation partner and fellow film buffs to hit up screenings.",
        "interests": ["philosophy", "french cinema", "existentialism", "poetry", "coffee shops", "film festivals"],
        "pronouns": "she/her",
        "location": "Westminster Hall",
        "personality": "Introspective intellectual who asks thought-provoking questions. Quotes philosophers casually in conversation. Appreciates silence and meaningful pauses. Writes in cafes and always has a book recommendation.",
    },
    {
        "email": "tyler.johnson@college.edu",
        "password": "demo123",
        "display_name": "Tyler Johnson",
        "bio": "Music major focusing on jazz performance (saxophone). Also into music production and sound design. Host weekly jam sessions in my dorm. Always looking for collaborators and people to hit shows with.",
        "interests": ["jazz", "saxophone", "music production", "concerts", "sound design", "vinyl collecting"],
        "pronouns": "he/him",
        "location": "Compton Hall",
        "personality": "Laid-back creative with perfectionist tendencies about music. Lives in the moment and improvises life like a jazz solo. Great listener who vibes with people easily. Late sleeper who's most creative at night.",
    },
    {
        "email": "priya.sharma@college.edu",
        "password": "demo123",
        "display_name": "Priya Sharma",
        "bio": "Environmental studies major and climate activist. Organizing campus sustainability initiatives. Love gardening, thrifting, and cooking plant-based meals. Let's swap recipes or start a community garden!",
        "interests": ["sustainability", "gardening", "vegan cooking", "thrifting", "climate activism", "zero waste"],
        "pronouns": "she/her",
        "location": "Douglass Hall",
        "personality": "Passionate advocate with practical solutions. Turns conversations into action plans. Optimistic despite harsh realities. Organized and detail-oriented but also knows how to have fun. Morning yoga enthusiast.",
    },
    {
        "email": "ethan.moore@college.edu",
        "password": "demo123",
        "display_name": "Ethan Moore",
        "bio": "History major obsessed with WWI, ancient Rome, and historical podcasts. Play a lot of strategy games and D&D. Looking for players for a new campaign and people to debate alternate history scenarios with.",
        "interests": ["history", "D&D", "strategy games", "podcasts", "historical fiction", "board games"],
        "pronouns": "he/him",
        "location": "Wagner Hall",
        "personality": "Encyclopedia of obscure historical facts. Patient dungeon master who creates elaborate worlds. Enjoys complex systems and long-term planning. Comfortable in small groups but can get talking once passionate.",
    },
    {
        "email": "zara.okonkwo@college.edu",
        "password": "demo123",
        "display_name": "Zara Okonkwo",
        "bio": "Political science major and debate team captain. Interning at a civil rights non-profit. Passionate about social justice, poetry, and Afrobeat music. Always ready for intellectual sparring or dance parties.",
        "interests": ["debate", "social justice", "poetry", "Afrobeat", "politics", "spoken word"],
        "pronouns": "she/her",
        "location": "Kenarden Lodge",
        "personality": "Eloquent and persuasive with strong convictions. Challenges ideas respectfully and loves being challenged. High energy that's contagious. Organized chaos in physical spaces but mental clarity in arguments.",
    },
    {
        "email": "liam.otoole@college.edu",
        "password": "demo123",
        "display_name": "Liam O'Toole",
        "bio": "English major and aspiring novelist. Editor for the campus lit magazine. Love classic literature, creative writing workshops, and rainy day reading marathons. Let's form a writing group or book club!",
        "interests": ["creative writing", "literature", "book clubs", "poetry", "journalism", "tea"],
        "pronouns": "he/him",
        "location": "Stevenson Hall",
        "personality": "Observant introvert who notices the little things. Expresses self better in writing than speech. Appreciates quiet spaces and one-on-one conversations. Romantic about ideas and melancholic in a cozy way.",
    },
    {
        "email": "nina.volkov@college.edu",
        "password": "demo123",
        "display_name": "Nina Volkov",
        "bio": "Biochemistry major researching cancer treatments. Work-study in the lab 20hrs/week. Destress with baking, true crime podcasts, and binge-watching medical dramas. Need study buddies for organic chem!",
        "interests": ["biochemistry", "baking", "true crime", "medical dramas", "research", "STEM outreach"],
        "pronouns": "she/her",
        "location": "Bissman Hall",
        "personality": "Focused and ambitious with a methodical approach. Stress-bakes when overwhelmed and brings treats to share. Curious about how things work at molecular level. Surprisingly funny once comfortable.",
    },
    {
        "email": "carlos.rivera@college.edu",
        "password": "demo123",
        "display_name": "Carlos Rivera",
        "bio": "Sociology major studying urban development. Grew up in NYC, love street photography, hip-hop culture, and finding hidden gems in new cities. Teach salsa dancing on weekends!",
        "interests": ["sociology", "photography", "hip-hop", "salsa dancing", "urban exploration", "street art"],
        "pronouns": "he/him",
        "location": "Luce Hall",
        "personality": "Outgoing storyteller with street smarts. Connects people and ideas naturally. Documents life through photos. Teaches others patiently. Brings NYC energy to small town campus. Night owl and city explorer.",
    },
    {
        "email": "hannah.goldstein@college.edu",
        "password": "demo123",
        "display_name": "Hannah Goldstein",
        "bio": "Math major who thinks proofs are beautiful. Tutor at the math help center. Also love knitting, puzzle hunts, and bad puns. Looking for people to solve escape rooms and crosswords with!",
        "interests": ["mathematics", "knitting", "puzzles", "escape rooms", "crosswords", "logic games"],
        "pronouns": "she/her",
        "location": "Kittredge Hall",
        "personality": "Methodical thinker who finds joy in solving problems. Patient explainer who never makes others feel dumb. Quiet but witty with perfectly timed comments. Creates cozy spaces and brings calm energy.",
    },
    {
        "email": "jamal.washington@college.edu",
        "password": "demo123",
        "display_name": "Jamal Washington",
        "bio": "Business major and entrepreneur running a sneaker resale side hustle. Love fashion, streetwear culture, and building businesses. Always networking and down to brainstorm startup ideas over coffee.",
        "interests": ["entrepreneurship", "fashion", "sneakers", "streetwear", "business", "investing"],
        "pronouns": "he/him",
        "location": "Holden Annex",
        "personality": "Ambitious hustler with growth mindset. Sees opportunities everywhere. Natural networker who remembers details about people. Confident but not arrogant. Early riser who journals and plans each day.",
    },
    {
        "email": "lily.nguyen@college.edu",
        "password": "demo123",
        "display_name": "Lily Nguyen",
        "bio": "Psychology major interested in cognitive science and UX design. Vice president of the mindfulness club. Love bullet journaling, indie folk music, and long walks. Let's study together or plan a camping trip!",
        "interests": ["psychology", "mindfulness", "UX design", "bullet journaling", "indie folk", "camping"],
        "pronouns": "she/her",
        "location": "Andrews Hall",
        "personality": "Empathetic listener who creates safe spaces. Notices subtle emotional cues. Organized planner who color-codes everything. Balances logic with intuition. Loves deep conversations and nature therapy.",
    },
]

added = 0
for user_data in sample_users:
    exists = db.query(User).filter(User.email == user_data["email"]).first()
    photo_url = ensure_local_photo(user_data["email"], user_data["display_name"])
    desired_photos = [photo_url] if photo_url else [f"https://i.pravatar.cc/300?u={user_data['email']}"]

    if not exists:
        # Store personality in bio for now - can be moved to separate field if needed
        full_bio = f"{user_data['bio']}\n\n[Personality: {user_data['personality']}]"
        
        user = User(
            email=user_data["email"],
            password_hash=hash_password(user_data["password"]),
            display_name=user_data["display_name"],
            bio=full_bio,
            interests=user_data["interests"],
            pronouns=user_data.get("pronouns"),
            location=user_data.get("location"),
            photos=desired_photos,
        )
        db.add(user)
        added += 1
    else:
        if not exists.photos or exists.photos != desired_photos:
            exists.photos = desired_photos
            db.add(exists)

db.commit()
db.close()

print(f"✅ Added {added} sample users to database!")
print(f"📧 All users have password: demo123")
print(f"\nSample logins:")
for i, user in enumerate(sample_users[:3], 1):
    print(f"  {i}. {user['email']} / demo123 - {user['display_name']}")
print(f"  ... and 12 more users!")
