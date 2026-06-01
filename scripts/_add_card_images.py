import re

PH = "/assets/og/3d-molier-og.jpg"

IMGS = {
  'A320':     'https://p.turbosquid.com/ts-thumb/pi/DyjmYF/wKi9psVt/airbusa320generic3dmodel002/jpg/1512451344/1920x1080/fit_q87/e890b6bbba43d7da1e344e2f760a87c9d8f25b9b/airbusa320generic3dmodel002.jpg',
  'A400M':    'https://p.turbosquid.com/ts-thumb/A7/rK78NN/VzNPX9hE/airbusa400matlasmilitarytransportaircraftriggedmb3dmodel001/jpg/1588190727/1920x1080/fit_q87/830ab8199cdf4bef09f27e1dc5f4cc57bcdc184f/airbusa400matlasmilitarytransportaircraftriggedmb3dmodel001.jpg',
  'F35':      'https://p.turbosquid.com/ts-thumb/y8/ZPe3Ro/pHNzwZ2P/stealth_multirole_fighter_f_35_lightning_ii_001/jpg/1507269841/1920x1080/fit_q87/c431d6e7a58a86045a60fc001168651ea9986c8b/stealth_multirole_fighter_f_35_lightning_ii_001.jpg',
  'SIKORSKY': 'https://p.turbosquid.com/ts-thumb/34/5G5ITt/9uwrFmvi/sikorskyuh60blackhawkusmilitaryutilityhelicopterc4dmodel002/jpg/1477311781/1920x1080/fit_q87/0d8ee50de73df309fe971dd667db85a7ad6249e0/sikorskyuh60blackhawkusmilitaryutilityhelicopterc4dmodel002.jpg',
  'BODY':     'https://p.turbosquid.com/ts-thumb/Af/2AjP8g/vfRF5a8r/malefullbodyanatomyandskinmb3dmodel002/jpg/1572784988/1920x1080/fit_q87/4f7061185e55a42558f6035ce2fc92145ef25ed1/malefullbodyanatomyandskinmb3dmodel002.jpg',
  'SKELETON': 'https://p.turbosquid.com/ts-thumb/S5/62n0au/XEsnWIMC/maleskeletoncollection3dmodels001/jpg/1464516498/1920x1080/fit_q87/f727862d2f791438d6ac5f04de1fa7ead368fa19/maleskeletoncollection3dmodels001.jpg',
  'EIFFEL':   'https://p.turbosquid.com/ts-thumb/5V/qfh6M1/teDcBu23/eiffeltowervray3dmodel001/jpg/1600848155/1920x1080/fit_q87/b35b13af1bfb07140a8bfb19e60e094a46287b76/eiffeltowervray3dmodel001.jpg',
  'SHANGHAI': 'https://p.turbosquid.com/ts-thumb/ew/MC3eK6/wD7dE3o4/shanghaitowerchina3dmodel01/jpg/1425888870/1920x1080/fit_q87/70c293e6fbda56881baafbcd355682e8d6a6beb9/shanghaitowerchina3dmodel01.jpg',
  'COLOSS':   'https://p.turbosquid.com/ts-thumb/Re/XIZ00y/8KBqndvi/colosseumvray3dmodel001/jpg/1545243841/1920x1080/fit_q87/70e6e51f301b0463ce05633ff73b14b63782803f/colosseumvray3dmodel001.jpg',
  'HANDS':    'https://p.turbosquid.com/ts-thumb/6x/gvz1ss/MxAGaphD/manhandsriggedcinema4d3dmodel01/jpg/1481983483/1920x1080/fit_q87/d75506941b4abdc56d0c83c7bf2e0b6a9cc7b4b9/manhandsriggedcinema4d3dmodel01.jpg',
  'HAT':      'https://p.turbosquid.com/ts-thumb/4q/1vAjNW/J9/baseball_hat_3_001/jpg/1626786034/1920x1080/fit_q87/47e19e3348fa441aadd838d6f77ff0eb5c74d2b6/baseball_hat_3_001.jpg',
  'TRANSIT':  'https://p.turbosquid.com/ts-thumb/Hs/wp2JO0/vS/ford_transit_cargo_2020_002/jpg/1625749741/1920x1080/fit_q87/9b4ec2e34fdad9b933be803227c827b1b2f29580/ford_transit_cargo_2020_002.jpg',
  'CONVBELT': 'https://p.turbosquid.com/ts-thumb/KH/d6v0lz/VCZ7Igwf/conveyorbelt3dmodel01/jpg/1427212124/1920x1080/fit_q87/3ebe720e583ac1ce5c0ffb5b9004f8a8e252ca67/conveyorbelt3dmodel01.jpg',
  'SUBM':     'https://p.turbosquid.com/ts-thumb/Lr/AiEbj2/PnjyOIMy/virginiaclasssubmarinessn774mb3dmodel001/jpg/1482406773/1920x1080/fit_q87/9aeac52244c4531f698e5b5446c3dd0dbca91d0d/virginiaclasssubmarinessn774mb3dmodel001.jpg',
  'DESTR':    'https://p.turbosquid.com/ts-thumb/SL/ADsGMi/QC8bWvGc/arleighburkedestroyerporterddg78vray3dmodel001/jpg/1494924344/1920x1080/fit_q87/bd584006af21f7d720ed14813bc6f8356edf2cb2/arleighburkedestroyerporterddg78vray3dmodel001.jpg',
  'BOAT':     'https://p.turbosquid.com/ts-thumb/O3/bhZ45W/hTY2ccZL/qatartraditionalboatc4dmodel001/jpg/1545056663/1920x1080/fit_q87/dcd83f6d4101b05b7552cf7f3288bf819c7e701d/qatartraditionalboatc4dmodel001.jpg',
  'PHONE':    'https://p.turbosquid.com/ts-thumb/u9/zpxZjk/m2j8xMZc/blacksmartphone3dmodel001/jpg/1579798107/1920x1080/fit_q87/db5d5fe4ea5002950e0fe1f5fa254ef32c000a3b/blacksmartphone3dmodel001.jpg',
  'ORCHID':   'https://p.turbosquid.com/ts-thumb/Nf/0GxHyD/aK/orchid_flower_002/jpg/1625801442/1920x1080/fit_q87/fecc8615a0d29360bcd125e476c8ad8a2ee593f2/orchid_flower_002.jpg',
  'TESLA':    'https://p.turbosquid.com/ts-thumb/6I/BNMOUr/TV/tesla_model_3_002/jpg/1625762643/1920x1080/fit_q87/4e96882f57561f81063dbba6aa0893596a3b5ec1/tesla_model_3_002.jpg',
}

def img_strip(cls, key, alt):
    url = IMGS[key]
    return (f'<div class="{cls}"><img src="{url}" alt="{alt}" '
            f'loading="lazy" width="800" height="450" decoding="async" '
            f'data-fallback="{url}" data-placeholder="{PH}" '
            f'onerror="handleImageError(this)"></div>\n')

# ======================== index.html ========================
html = open('index.html', encoding='utf-8').read()

ind_map = {
  '/industries/aerospace/':             ('A320',     'Aerospace 3D models'),
  '/industries/military-defense/':      ('SIKORSKY', 'Military and Defense 3D models'),
  '/industries/medical/':               ('BODY',     'Medical 3D models'),
  '/industries/game-development/':      ('HANDS',    'Game Development 3D models'),
  '/industries/film-video-production/': ('A400M',    'Film and Video 3D models'),
  '/industries/architecture/':          ('EIFFEL',   'Architecture 3D models'),
  '/industries/virtual-reality/':       ('HAT',      'Virtual Reality 3D models'),
  '/industries/advertising/':           ('TRANSIT',  'Advertising 3D models'),
}

for href, (key, alt) in ind_map.items():
    strip = img_strip('ind-card-img', key, alt)
    pattern = r'(<a href="' + re.escape(href) + r'" class="ind-card"[^>]*>\s*)(<span class="ind-icon")'
    if re.search(pattern, html):
        html = re.sub(pattern, r'\g<1>' + strip + r'\g<2>', html)
    else:
        print('WARN ind-card not found: ' + href)

col_map = {
  '/collections/best-vehicle-3d-models/':          ('TESLA',   'Best Vehicle 3D Models'),
  '/collections/best-aircraft-3d-models/':         ('A320',    'Best Aircraft 3D Models'),
  '/collections/best-medical-3d-models/':          ('BODY',    'Best Medical 3D Models'),
  '/collections/checkmate-certified-3d-models/':   ('HANDS',   'CheckMate Certified 3D Models'),
  '/collections/best-military-vehicle-3d-models/': ('F35',     'Best Military Vehicle 3D Models'),
  '/collections/best-ship-3d-models/':             ('BOAT',    'Best Ship 3D Models'),
}

for href, (key, alt) in col_map.items():
    strip = img_strip('col-card-img', key, alt)
    pattern = r'(<a href="' + re.escape(href) + r'"[^>]*class="col-card">\s*)(<div class="col-icon")'
    if re.search(pattern, html):
        html = re.sub(pattern, r'\g<1>' + strip + r'\g<2>', html)
    else:
        print('WARN col-card not found: ' + href)

open('index.html', 'w', encoding='utf-8').write(html)
print('index.html done')

# ======================== collections/index.html ========================
html2 = open('collections/index.html', encoding='utf-8').read()

coll_map = {
  '/collections/best-vehicle-3d-models/':                    ('TESLA',    'Best Vehicle 3D Models'),
  '/collections/best-military-vehicle-3d-models/':           ('F35',      'Best Military Vehicle 3D Models'),
  '/collections/best-aircraft-3d-models/':                   ('A320',     'Best Aircraft 3D Models'),
  '/collections/best-ship-3d-models/':                       ('BOAT',     'Best Ship 3D Models'),
  '/collections/best-industrial-equipment-3d-models/':       ('CONVBELT', 'Best Industrial Equipment 3D Models'),
  '/collections/best-medical-3d-models/':                    ('BODY',     'Best Medical 3D Models'),
  '/collections/best-architecture-landmark-3d-models/':      ('EIFFEL',   'Best Architecture Landmark 3D Models'),
  '/collections/3d-models-for-aerospace-visualization/':     ('A400M',    '3D Models for Aerospace'),
  '/collections/3d-models-for-medical-visualization/':       ('SKELETON', '3D Models for Medical Visualization'),
  '/collections/3d-models-for-defense-simulation/':          ('SUBM',     '3D Models for Defense Simulation'),
  '/collections/3d-models-for-film-production/':             ('HANDS',    '3D Models for Film Production'),
  '/collections/3d-models-for-vr-projects/':                 ('HAT',      '3D Models for VR Projects'),
  '/collections/3d-models-for-game-development/':            ('TESLA',    '3D Models for Game Development'),
  '/collections/3d-models-for-advertising/':                 ('TRANSIT',  '3D Models for Advertising'),
  '/collections/3d-models-for-architecture-visualization/':  ('SHANGHAI', '3D Models for Architecture Visualization'),
  '/collections/3d-models-for-event-management/':            ('COLOSS',   '3D Models for Event Management'),
  '/collections/3d-models-for-hardware-presentation/':       ('PHONE',    '3D Models for Hardware Presentation'),
  '/collections/checkmate-certified-3d-models/':             ('DESTR',    'CheckMate Certified 3D Models'),
  '/collections/stemcell-certified-3d-models/':              ('ORCHID',   'StemCell Certified 3D Models'),
}

for href, (key, alt) in coll_map.items():
    strip = img_strip('coll-idx-img', key, alt)
    pattern = r'(<a href="' + re.escape(href) + r'" class="coll-idx-card">\s*)(<div class="coll-idx-head")'
    if re.search(pattern, html2):
        html2 = re.sub(pattern, r'\g<1>' + strip + r'\g<2>', html2)
    else:
        print('WARN coll-idx-card not found: ' + href)

open('collections/index.html', 'w', encoding='utf-8').write(html2)
print('collections/index.html done')
