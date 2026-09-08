AAA STREET PASS 10
====================
Incremental architecture specification for the current street rebuild.

The target is a realistic lived-in American small city, not a low-poly
collection of boxes. Building families must have distinct footprints and
silhouettes; roads are opaque and layered; crosswalks are generated once
per intersection; background masses are not used as fake walls.

Required visual stack:
road -> curb -> sidewalk -> lot -> building -> facade details -> props.
Materials use basecolor/normal/roughness/AO where available. Decals are used
for foundation grime, oil stains, and rain streaks. LOD is distance based.

Apply this patch over the current 09 patch.
Only files in this patch are changed/added.
