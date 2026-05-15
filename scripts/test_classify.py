import sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from classify import classify_model

tests = [
    # Bug fixes
    ("Pickup Truck Generic Simple Interior",    "Vehicles"),
    ("Modern Living Room Interior",             "Architecture Landmarks"),
    # Priority categories
    ("Tesla Model 3",                           "Vehicles"),
    ("Ford Transit Cargo 2020",                 "Vehicles"),
    ("Airbus A320 Generic",                     "Aircraft"),
    ("F-16 Fighter Jet",                        "Military Vehicles"),
    ("Male Full Body Anatomy and Skin",         "Medical"),
    ("Male Skeleton Collection",                "Medical"),
    ("20 ft ISO Container White",               "Industrial Equipment"),
    ("Robotic Arm Silver",                      "Industrial Equipment"),
    # New categories
    ("Man Hands 2 Rigged for Cinema 4D",        "Characters & People"),
    ("Baseball Hat 3",                          "Clothing & Accessories"),
    ("Orchid Flower",                           "Nature & Plants"),
    ("Octopus Tentacle Rigged for Cinema 4D",   "Animals & Creatures"),
    ("iPhone 15 Pro Max",                       "Electronics & Gadgets"),
    ("Oak Tree Low Poly",                       "Nature & Plants"),
    ("Dining Chair Modern",                     "Furniture & Interior"),
    ("Leather Jacket",                          "Clothing & Accessories"),
    ("Pizza Slice",                             "Food & Beverages"),
    ("Medieval Sword Rigged",                   "Weapons & Tools"),
    ("Cash Cannon",                             "Weapons & Tools"),
    ("Arc Candle Lighter Rigged",               "Weapons & Tools"),
]

passed = 0
failed = 0
for title, expected in tests:
    got = classify_model(title)["category"]
    ok = got == expected
    status = "OK" if ok else "FAIL"
    if ok:
        passed += 1
    else:
        failed += 1
    print(f"  [{status}]  {got:<28}  (expected: {expected:<28})  {title}")

print(f"\n  {passed}/{len(tests)} passed   {failed} failed")
