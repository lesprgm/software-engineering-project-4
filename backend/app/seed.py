from app.database import SessionLocal
from app.models.places import Place
import sys
from pathlib import Path


sys.path.append(str(Path(__file__).resolve().parent))

db = SessionLocal()

new_place = Place(
    name="Wayne County Historical Society",
    description="A great place to explore local history and art exhibits. Perfect for casual hangouts or study breaks.",
    location="546 East Bowman St., Wooster, Ohio 44691",
    rating=4.8,
    tags="museum, history, chill, culture",
    photo_url="https://dynamic-media-cdn.tripadvisor.com/media/photo-o/20/19/f6/d7/the-wayne-county-historical.jpg?w=1400&h=-1&s=1"
)
new_place = Place(
        name="Christmas Run Park",
        description="Open green space perfect for picnics, frisbee, or casual hangouts.",
        location="Park Ave, Wooster, OH 44691",
        rating=4.7,
        tags="park, outdoors, chill, sports",
        photo_url="https://www.woosteroh.com/sites/default/files/styles/basic_image/public/2018-10/Christmas%20Run%202.jpg?itok=cG829Rcy"
    )

db.add(new_place)
db.commit()
db.close()

print("✅ Seed data added successfully!")
