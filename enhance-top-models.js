const fs = require('fs');
const path = require('path');

const root = 'd:/3d/документы/Blogger/Clode_and_Gpt_Website';
const base = 'https://3dmolier.github.io/3D-Models';

// Top model enhancements: slug → extra content
const enhancements = {
  'tesla-model-3-1214116': {
    bestFor: 'Automotive advertising, product visualization, EV content, game environments, architectural renders with parked vehicles',
    techFeatures: 'Accurate 1:1 real-world scale, clean quad topology, 4K PBR textures (albedo, roughness, metallic, normal), all doors and trunk openable, interior fully modeled',
    formats: 'FBX, OBJ, 3ds Max (.MAX), Cinema 4D (.C4D), Blender (.BLEND)',
    compatibility: 'Unreal Engine, Unity, Blender, Maya, 3ds Max, Cinema 4D, KeyShot, V-Ray, Arnold, Octane',
    useCases: 'TV commercials, product CGI, game traffic, architectural visualization background vehicles, EV brand content',
  },
  'airbus-a320-generic-1230754': {
    bestFor: 'Aerospace visualization, airline advertising, flight simulation backgrounds, film production, engineering presentations',
    techFeatures: 'Correct ICAO A320 dimensions, movable control surfaces (flaps, ailerons, rudder), landing gear deploy/retract, detailed engine nacelles (CFM56), real-world scale',
    formats: 'FBX, OBJ, 3ds Max (.MAX)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, V-Ray, Corona, Arnold',
    useCases: 'Airline promotional content, aviation training visuals, airport simulation, film aerial sequences, aerospace engineering documentation',
  },
  'ford-transit-cargo-2020-1485058': {
    bestFor: 'Delivery fleet visualization, logistics advertising, film and TV, game environments, architectural context rendering',
    techFeatures: 'Accurate Ford Transit L2H2 dimensions, sliding side door, rear doors, interior cargo area modeled, correct wheel and tire profile, PBR textures',
    formats: 'FBX, OBJ, 3ds Max (.MAX), Cinema 4D (.C4D)',
    compatibility: 'Unreal Engine, Unity, Blender, Maya, 3ds Max, Cinema 4D, V-Ray',
    useCases: 'Fleet livery mockups, last-mile delivery advertising, film production vehicles, game traffic spawns, logistics company presentations',
  },
  'sikorsky-uh-60-black-hawk-us-military-utility-helicopter-1085902': {
    bestFor: 'Military simulation, defense training, film and TV, game development, aerospace visualization',
    techFeatures: 'Accurate UH-60 Black Hawk dimensions, full rotor system with correct blade count, tail rotor, detailed cockpit glass, landing skids, engine fairings',
    formats: 'FBX, OBJ, 3ds Max (.MAX)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, Maya, V-Ray, Arnold',
    useCases: 'Military training simulations, defense sector presentations, action film VFX, war game development, homeland security content',
  },
  'male-full-body-anatomy-and-skin-1467539': {
    bestFor: 'Medical education, VR anatomy training, pharmaceutical visualization, surgical simulation, health content',
    techFeatures: 'Complete male anatomy with 200+ named anatomical structures, layered mesh (skin, subcutaneous fat, muscle, skeleton), StemCell rig for animation, medically reviewed proportions',
    formats: 'FBX, OBJ, Cinema 4D (.C4D)',
    compatibility: 'Unreal Engine, Unity, Blender, Maya, Cinema 4D, 3ds Max, ZBrush',
    useCases: 'Medical school curricula, anatomy VR apps, pharmaceutical advertising, surgical planning visualization, health education platforms',
  },
  'male-skeleton-collection-1041670': {
    bestFor: 'Medical education, forensic visualization, VR training, anatomy content, Halloween/horror props',
    techFeatures: '206 individual anatomically correct bones, articulated joints, StemCell certified rig, full-body and isolated views, medically accurate bone morphology',
    formats: 'FBX, OBJ, Cinema 4D (.C4D)',
    compatibility: 'Unreal Engine, Unity, Blender, Maya, Cinema 4D',
    useCases: 'Medical education, forensic science visualization, physical therapy training, VR anatomy apps, museum exhibits',
  },
  'pickup-truck-generic-simple-interior-1464102': {
    bestFor: 'American lifestyle advertising, game traffic, film backgrounds, construction site context, ranch/rural visualization',
    techFeatures: 'Generic American pickup with clean topology, simple interior, working doors, correct truck-class proportions, CheckMate Lite certified',
    formats: 'FBX, OBJ, 3ds Max (.MAX)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, Maya, V-Ray',
    useCases: 'Truck brand mockups, rural lifestyle ads, game NPC vehicles, construction site rendering, country/western themed projects',
  },
  'generic-hybrid-car-942006': {
    bestFor: 'Generic automotive content, brand-agnostic car renders, game traffic, architectural context, advertising with no specific model reference',
    techFeatures: 'Clean sedan topology, 4-door with interior, correct car-class proportions, CheckMate Lite certified, easy to brand/repaint',
    formats: 'FBX, OBJ, 3ds Max (.MAX)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, Maya, V-Ray, Cinema 4D',
    useCases: 'Generic automotive ads, smart city visualizations, game traffic systems, architecture background vehicles, mobility platform content',
  },
  '2024-tesla-cybertruck-2181273': {
    bestFor: 'EV advertising, futuristic tech content, automotive media, game scenarios, product showcase',
    techFeatures: 'Accurate 2024 Cybertruck dimensions, stainless steel body geometry, exoskeleton design, vault bed, frunk, StemCell certified for animation',
    formats: 'FBX, OBJ, 3ds Max (.MAX), Cinema 4D (.C4D)',
    compatibility: 'Unreal Engine, Unity, Blender, Maya, 3ds Max, Cinema 4D, KeyShot',
    useCases: 'Tesla/EV brand content, futuristic city renders, automotive YouTube/social media, game open-world vehicles, tech product advertising',
  },
  'lockheed-c-130-hercules-us-military-transport-aircraft-1121545': {
    bestFor: 'Military transport visualization, defense contracts, film/TV military scenes, aerospace simulation, humanitarian aid content',
    techFeatures: 'Accurate C-130H/J dimensions, 4 turboprop engines, full wing and tail geometry, cargo ramp, correct USAF proportions, CheckMate Pro',
    formats: 'FBX, OBJ, 3ds Max (.MAX)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, Maya, V-Ray, Arnold',
    useCases: 'USAF training content, defense sector advertising, film aerial sequences, disaster relief visualizations, military museum exhibits',
  },
  'semi-truck-with-trailer-generic-simple-interior-1521260': {
    bestFor: 'Logistics advertising, highway renders, film/TV production, game open-world traffic, freight company content',
    techFeatures: 'Full semi-truck with 53ft trailer, correct Class 8 dimensions, fifth wheel articulation, simple cab interior, CheckMate Lite certified',
    formats: 'FBX, OBJ, 3ds Max (.MAX)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, Maya, V-Ray',
    useCases: 'Freight/logistics brand content, highway infrastructure visualization, trucking industry ads, game highway traffic, film chase sequences',
  },
  'mercedes-sprinter-van-2019-1366261': {
    bestFor: 'Commercial vehicle advertising, transit fleet visualization, film/TV, game vehicles, camper/conversion van content',
    techFeatures: 'Accurate Mercedes Sprinter 2500 dimensions, sliding door, rear barn doors, interior modeled, correct proportions, CheckMate Lite',
    formats: 'FBX, OBJ, 3ds Max (.MAX), Cinema 4D (.C4D)',
    compatibility: 'Unreal Engine, Unity, Blender, 3ds Max, Cinema 4D, V-Ray',
    useCases: 'Mercedes fleet branding, conversion van advertising, medical/emergency vehicle bases, film production, food truck conversions, game NPC vehicles',
  },
  'tesla-model-s-100d-2017-3d-model-1144931': {
    bestFor: 'Luxury EV advertising, automotive media, product CGI, game vehicles, tech brand content',
    techFeatures: 'Accurate Tesla Model S 100D dimensions, dual-motor exterior details, panoramic roof, interior modeled, 4K PBR textures, CheckMate Pro',
    formats: 'FBX, OBJ, 3ds Max (.MAX), Cinema 4D (.C4D)',
    compatibility: 'Unreal Engine, Unity, Blender, Maya, 3ds Max, Cinema 4D, KeyShot, V-Ray',
    useCases: 'Tesla promotional content, luxury EV advertising, supercar game vehicles, automotive YouTube content, product visualization',
  },
};

function buildEnhancementHTML(data) {
  return `
<!-- Enhanced Content Section -->
<section style="padding:0 24px 40px;">
  <div style="max-width:1280px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr;gap:48px;align-items:start;">
    <div style="display:flex;flex-direction:column;gap:28px;">

      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#111111;margin-bottom:10px;">Best Used For</div>
        <p style="font-size:14px;color:#6b7280;line-height:1.75;">${data.bestFor}</p>
      </div>

      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#111111;margin-bottom:10px;">Technical Features</div>
        <p style="font-size:14px;color:#6b7280;line-height:1.75;">${data.techFeatures}</p>
      </div>

      <div>
        <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#111111;margin-bottom:10px;">Use Cases</div>
        <p style="font-size:14px;color:#6b7280;line-height:1.75;">${data.useCases}</p>
      </div>

    </div>
    <div style="display:flex;flex-direction:column;gap:20px;">

      <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:10px;padding:20px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin-bottom:12px;">File Formats</div>
        <p style="font-size:13px;color:#111111;line-height:1.7;">${data.formats}</p>
      </div>

      <div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:10px;padding:20px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;margin-bottom:12px;">Compatible With</div>
        <p style="font-size:13px;color:#6b7280;line-height:1.7;">${data.compatibility}</p>
      </div>

      <div style="background:#f9fafb;border:1px solid #e5e5e5;border-radius:10px;padding:20px;">
        <div style="font-size:13px;font-weight:600;color:#111111;margin-bottom:8px;">Need this adapted?</div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:12px;">Custom colors, topology changes, format conversion or rigging — we handle it.</p>
        <a href="/3D-Models/custom-order/" style="display:inline-block;background:#111111;color:#ffffff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:6px;text-decoration:none;">Request Custom Adaptation</a>
      </div>

    </div>
  </div>
</section>`;
}

let changed = 0;

Object.entries(enhancements).forEach(([slug, data]) => {
  const p = path.join(root, 'models', slug, 'index.html');
  if (!fs.existsSync(p)) {
    console.log('⚠ Not found:', slug);
    return;
  }
  let c = fs.readFileSync(p, 'utf8');
  if (c.includes('Best Used For')) {
    console.log('- Already enhanced:', slug);
    return;
  }

  // Insert enhanced section just before the "Related 3D Models" section
  const insertBefore = '<!-- MORE IN';
  if (c.includes(insertBefore)) {
    c = c.replace(insertBefore, buildEnhancementHTML(data) + '\n' + insertBefore);
  } else {
    // Fallback: insert before </main>
    c = c.replace('</main>', buildEnhancementHTML(data) + '\n</main>');
  }

  fs.writeFileSync(p, c, 'utf8');
  changed++;
  console.log('✓ Enhanced:', slug);
});

console.log('\nDone:', changed, 'model pages enhanced');
