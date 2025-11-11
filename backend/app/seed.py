from pathlib import Path
import sys

from app.database import SessionLocal
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
]

added = 0
for data in places_data:
    exists = db.query(Place).filter(Place.name == data["name"]).first()
    if not exists:
        db.add(Place(**data))
        added += 1

db.commit()
db.close()

print(f"✅ Seed data added successfully! ({added} new records)")
