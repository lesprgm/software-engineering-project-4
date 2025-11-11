from pathlib import Path
import sys

from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models.event import Event
from app.models.places import Place


sys.path.append(str(Path(__file__).resolve().parent))

db = SessionLocal()

places_data = [
    {
        "name": "Wayne County Historical Society",
        "description": "Explore local history and art exhibits. Perfect for casual hangouts or study breaks.",
        "location": "546 East Bowman St., Wooster, Ohio 44691",
        "rating": 4.8,
        "tags": "museum, history, chill, culture",
        "photo_url": "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/20/19/f6/d7/the-wayne-county-historical.jpg?w=1400&h=-1&s=1",
        "latitude": 40.8029,
        "longitude": -81.9340,
    },
    {
        "name": "Christmas Run Park",
        "description": "Open green space perfect for picnics, frisbee, or casual hangouts.",
        "location": "Park Ave, Wooster, OH 44691",
        "rating": 4.7,
        "tags": "park, outdoors, chill, sports",
        "photo_url": "https://www.woosteroh.com/sites/default/files/styles/basic_image/public/2018-10/Christmas%20Run%202.jpg?itok=cG829Rcy",
        "latitude": 40.8120,
        "longitude": -81.9535,
    },
    {
        "name": "Broken Rocks Cafe & Bakery",
        "description": "Cozy cafe with artisan breads, pasta, and desserts—perfect for brunch or low-key dates.",
        "location": "123 E Liberty St, Wooster, OH",
        "rating": 4.6,
        "tags": "restaurant, cafe, brunch, date-night",
        "photo_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
        "latitude": 40.7989,
        "longitude": -81.9376,
    },
    {
        "name": "City Square Steakhouse",
        "description": "Upscale steakhouse for celebratory dinners and special occasions.",
        "location": "148 S Market St, Wooster, OH",
        "rating": 4.7,
        "tags": "restaurant, steakhouse, upscale, dinner",
        "photo_url": "https://images.unsplash.com/photo-1555992336-cbf498b4c98c",
        "latitude": 40.7976,
        "longitude": -81.9381,
    },
    {
        "name": "Spoon Market & Deli",
        "description": "Local deli and market with creative sandwiches and grab-and-go bites.",
        "location": "144 W Liberty St, Wooster, OH",
        "rating": 4.5,
        "tags": "restaurant, deli, lunch, casual",
        "photo_url": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0",
        "latitude": 40.7983,
        "longitude": -81.9403,
    },
    {
        "name": "Basil Asian Bistro Wooster",
        "description": "Popular Pan-Asian spot featuring sushi, Thai dishes, and shareable plates.",
        "location": "145 W Liberty St, Wooster, OH",
        "rating": 4.4,
        "tags": "restaurant, asian, sushi, dinner",
        "photo_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
        "latitude": 40.7982,
        "longitude": -81.9401,
    },
    {
        "name": "Olde Jaol Steakhouse & Tavern",
        "description": "Historic jail-turned-restaurant serving steaks, seafood, and tavern fare.",
        "location": "215 N Walnut St, Wooster, OH",
        "rating": 4.4,
        "tags": "restaurant, historic, steakhouse, dinner",
        "photo_url": "https://images.unsplash.com/photo-1449049607083-e297f3f2122b",
        "latitude": 40.8004,
        "longitude": -81.9374,
    },
    {
        "name": "El Campesino Wooster",
        "description": "Colorful Mexican restaurant with combo plates and casual vibes.",
        "location": "44 E Milltown Rd, Wooster, OH",
        "rating": 4.3,
        "tags": "restaurant, mexican, casual, group",
        "photo_url": "https://images.unsplash.com/photo-1608039829574-9b864f06c4a0",
        "latitude": 40.8370,
        "longitude": -81.9415,
    },
    {
        "name": "TJ's Restaurant",
        "description": "Classic diner-style menu with hearty breakfasts and comfort food.",
        "location": "3124 Dover Rd, Wooster, OH",
        "rating": 4.2,
        "tags": "restaurant, diner, comfort-food, breakfast",
        "photo_url": "https://images.unsplash.com/photo-1498837167922-ddd27525d352",
        "latitude": 40.7709,
        "longitude": -81.9352,
    },
    {
        "name": "Omahoma Bob's BBQ",
        "description": "Beloved local BBQ joint with smoked meats and backyard picnic vibes.",
        "location": "75 E Liberty St, Wooster, OH",
        "rating": 4.6,
        "tags": "restaurant, bbq, casual, takeout",
        "photo_url": "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38",
        "latitude": 40.7986,
        "longitude": -81.9365,
    },
    {
        "name": "Tulipan Hungarian Pastry & Cafe",
        "description": "European-style cafe with decadent pastries, espresso, and light lunches.",
        "location": "122 E Liberty St, Wooster, OH",
        "rating": 4.8,
        "tags": "cafe, pastry, cozy, dessert",
        "photo_url": "https://images.unsplash.com/photo-1521017432531-fbd92d768814",
        "latitude": 40.7988,
        "longitude": -81.9374,
    },
    {
        "name": "Coccia House",
        "description": "Family-owned pizza institution known for thick crusts and huge toppings.",
        "location": "764 Pittsburg Ave, Wooster, OH",
        "rating": 4.5,
        "tags": "restaurant, pizza, casual, shareable",
        "photo_url": "https://images.unsplash.com/photo-1548365328-5b76a38f5960",
        "latitude": 40.8155,
        "longitude": -81.9297,
    },
    {
        "name": "The Rail - Downtown Wooster",
        "description": "Ohio-raised burgers, hand-cut fries, and milkshakes in a lively downtown space.",
        "location": "143 E Liberty St, Wooster, OH",
        "rating": 4.6,
        "tags": "restaurant, burgers, local, casual",
        "photo_url": "https://images.unsplash.com/photo-1550547660-d9450f859349",
        "latitude": 40.7992,
        "longitude": -81.9370,
    },
    {
        "name": "Local Roots Café & Market",
        "description": "Farm-to-table soups, sandwiches, and bakery items sourced from Wayne County growers.",
        "location": "140 S Walnut St, Wooster, OH",
        "rating": 4.7,
        "tags": "restaurant, farm-to-table, vegetarian, lunch",
        "photo_url": "https://images.unsplash.com/photo-1447078806655-40579c2520d6",
        "latitude": 40.7981,
        "longitude": -81.9379,
    },
    {
        "name": "The Wooster Inn Restaurant",
        "description": "Historic inn dining room with seasonal entrees and a patio overlooking campus.",
        "location": "801 E Wayne Ave, Wooster, OH",
        "rating": 4.4,
        "tags": "restaurant, fine-dining, patio, date-night",
        "photo_url": "https://images.unsplash.com/photo-1528605248644-14dd04022da1",
        "latitude": 40.8112,
        "longitude": -81.9179,
    },
    {
        "name": "The Leaf Restaurant & Bar",
        "description": "Upscale yet cozy dining inside Buehler’s with shareable plates and cocktails.",
        "location": "3540 Burbank Rd, Wooster, OH",
        "rating": 4.5,
        "tags": "restaurant, cocktails, upscale, dinner",
        "photo_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
        "latitude": 40.8412,
        "longitude": -81.9532,
    },
    {
        "name": "Matsos Family Restaurant",
        "description": "Classic Greek-American comfort food, famous for pizza and baklava.",
        "location": "154 W Liberty St, Wooster, OH",
        "rating": 4.3,
        "tags": "restaurant, greek, pizza, family-owned",
        "photo_url": "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0",
        "latitude": 40.7984,
        "longitude": -81.9397,
    },
    {
        "name": "Don Pancho’s Tex Mex Café",
        "description": "Colorful cantina with sizzling fajitas, tacos, and margaritas near campus housing.",
        "location": "2105 Lincoln Way E, Wooster, OH",
        "rating": 4.2,
        "tags": "restaurant, tex-mex, casual, group",
        "photo_url": "https://images.unsplash.com/photo-1608039829574-9b864f06c4a0",
        "latitude": 40.8073,
        "longitude": -81.9028,
    },
    {
        "name": "Chipotle Mexican Grill (Wooster Commons)",
        "description": "Popular fast-casual burrito spot for quick study-break meals.",
        "location": "3989 Burbank Rd, Wooster, OH",
        "rating": 4.1,
        "tags": "restaurant, mexican, fast-casual, takeout",
        "photo_url": "https://images.unsplash.com/photo-1608039829574-9b864f06c4a0",
        "latitude": 40.8536,
        "longitude": -81.9494,
    },
    {
        "name": "Panera Bread (Wooster)",
        "description": "Soups, salads, and study-friendly booths with reliable Wi-Fi.",
        "location": "3939 Burbank Rd, Wooster, OH",
        "rating": 4.0,
        "tags": "restaurant, cafe, bakery, study-spot",
        "photo_url": "https://images.unsplash.com/photo-1498654200943-1088dd4438ae",
        "latitude": 40.8524,
        "longitude": -81.9506,
    },
    {
        "name": "Buffalo Wild Wings (Wooster)",
        "description": "Game-day wings, trivia nights, and plenty of big screens for watch parties.",
        "location": "4127 Burbank Rd, Wooster, OH",
        "rating": 4.1,
        "tags": "restaurant, wings, sports, late-night",
        "photo_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836",
        "latitude": 40.8568,
        "longitude": -81.9522,
    },
    {
        "name": "LongHorn Steakhouse (Wooster)",
        "description": "Steaks, salads, and hearty sides—popular for celebratory dinners.",
        "location": "3820 Burbank Rd, Wooster, OH",
        "rating": 4.3,
        "tags": "restaurant, steakhouse, dinner, group",
        "photo_url": "https://images.unsplash.com/photo-1544025162-d76694265947",
        "latitude": 40.8476,
        "longitude": -81.9511,
    },
]

added = 0
for data in places_data:
    exists = db.query(Place).filter(Place.name == data["name"]).first()
    if not exists:
        db.add(Place(**data))
        added += 1

now = datetime.now(timezone.utc)
event_payloads = [
    {
        "title": "Campus Farmers Market",
        "description": "Local produce, live acoustic music, and student art pop-ups.",
        "location": "Lowry Center Patio",
        "category": "community",
        "start_time": now + timedelta(days=2, hours=11),
        "end_time": now + timedelta(days=2, hours=14),
        "tags": ["food", "outdoors", "community"],
    },
    {
        "title": "Open Mic @ The Alley",
        "description": "Share poetry, quick stand-up, or acoustic covers.",
        "location": "The Alley, College of Wooster",
        "category": "music",
        "start_time": now + timedelta(days=3, hours=19),
        "end_time": now + timedelta(days=3, hours=21),
        "tags": ["music", "nightlife"],
    },
    {
        "title": "Sunday Sunrise Yoga",
        "description": "Guided yoga session on the quad. Mats provided on request.",
        "location": "Campus Quad",
        "category": "wellness",
        "start_time": now + timedelta(days=4, hours=8),
        "end_time": now + timedelta(days=4, hours=9),
        "tags": ["wellness", "outdoors"],
    },
    {
        "title": "Resume + LinkedIn Workshop",
        "description": "Career Services hosts a drop-in resume and LinkedIn review.",
        "location": "Apex Learning Commons",
        "category": "career",
        "start_time": now + timedelta(days=1, hours=15),
        "end_time": now + timedelta(days=1, hours=16, minutes=30),
        "tags": ["career", "academic"],
    },
]

for payload in event_payloads:
    exists = db.query(Event).filter(Event.title == payload["title"]).first()
    if exists:
        continue
    event = Event(
        title=payload["title"],
        description=payload["description"],
        location=payload["location"],
        category=payload["category"],
        start_time=payload["start_time"],
        end_time=payload["end_time"],
        tags=",".join(payload["tags"]),
    )
    db.add(event)

db.commit()
db.close()

print(f"✅ Seed data added successfully! ({added} new places)")
