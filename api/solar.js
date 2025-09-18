// ========================= api/solar.js =========================
export default async function handler(req, res){
try{
const { lat, lng } = req.query;
if (!lat || !lng) return res.status(400).json({ error: 'Missing lat or lng' });


const key = process.env.GOOGLE_SOLAR_KEY;
if (!key) return res.status(500).json({ error: 'Server missing GOOGLE_SOLAR_KEY' });


// Find the closest building insights
const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
url.searchParams.set('location.latitude', String(lat));
url.searchParams.set('location.longitude', String(lng));
url.searchParams.set('requiredQuality', 'HIGH');
url.searchParams.set('key', key);


const r = await fetch(url.toString());
if (!r.ok){
const text = await r.text();
return res.status(r.status).json({ error:'Solar API error', detail:text });
}
const json = await r.json();


// Try to derive a simple polygon if present in the payload
// The Solar API focuses on solar metrics. Some regions include roof segment vectors in data layers.
// We expose a minimal shape if present and pass through metadata for the client.


let polygon = null; // GeoJSON ring in [lng, lat]
let pitchCategory = null;


try{
// If the insights include a dominant roof pitch in degrees, categorize it
const avgTilt = json.solarPotential?.roofSegmentStats?.azimuthStats?.averageTiltDegrees
|| json.solarPotential?.roofSegmentStats?.avgTiltDegrees
|| json.solarPotential?.wholeRoofStats?.avgTiltDegrees;
if (typeof avgTilt === 'number'){
pitchCategory = avgTilt < 15 ? 'low' : (avgTilt < 30 ? 'medium' : 'high');
}


// If an outline is embedded, expose it. Many responses will not include this.
const outline = json.buildingInsights?.footprintPolygon || json.outline || null;
if (outline && outline.coordinates){
const ring = outline.type === 'Polygon' ? outline.coordinates[0]
: outline.type === 'MultiPolygon' ? outline.coordinates[0][0]
: null;
if (ring && ring.length >= 3) polygon = ring;
}


// If there is a dataLayers link for roof segments, you can extend this endpoint
// to fetch and vectorize the mask into a polygon. That is beyond a minimal starter.
}catch{}


return res.status(200).json({ raw: json, polygon, pitchCategory });
}catch(e){
return res.status(500).json({ error:String(e) });
}
}
