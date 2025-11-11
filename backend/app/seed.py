from app.database import SessionLocal
from pathlib import Path
import sys

from app.models.places import Place


sys.path.append(str(Path(__file__).resolve().parent))

db = SessionLocal()

db.add_all(
    [
        Place(
            name="Wayne County Historical Society",
            description="Explore local history and art exhibits. Perfect for casual hangouts or study breaks.",
            location="546 East Bowman St., Wooster, Ohio 44691",
            rating=4.8,
            tags="museum, history, chill, culture",
            photo_url="https://dynamic-media-cdn.tripadvisor.com/media/photo-o/20/19/f6/d7/the-wayne-county-historical.jpg?w=1400&h=-1&s=1",
            latitude=40.8029,
            longitude=-81.9340,
        ),
        Place(
            name="Christmas Run Park",
            description="Open green space perfect for picnics, frisbee, or casual hangouts.",
            location="Park Ave, Wooster, OH 44691",
            rating=4.7,
            tags="park, outdoors, chill, sports",
            photo_url="https://www.woosteroh.com/sites/default/files/styles/basic_image/public/2018-10/Christmas%20Run%202.jpg?itok=cG829Rcy",
            latitude=40.8120,
            longitude=-81.9535,
        ),
    ]
)
db.commit()
db.close()

print("✅ Seed data added successfully!")
