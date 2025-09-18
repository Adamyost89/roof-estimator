// ========================= api/vision.js =========================
export default async function handler(req, res){
try{
if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
const { lat, lng, zoom = 21, size = 640, imageUrl } = req.body || {};
if (!lat || !lng || !imageUrl) return res.status(400).json({ error:'Missing fields' });


const openaiKey = process.env.OPENAI_API_KEY;
if (!openaiKey) return res.status(500).json({ error:'Server missing OPENAI_API_KEY' });


const prompt = `You are mapping a roof from a nadir satellite image.
Return a single valid GeoJSON Feature with a Polygon geometry outlining the main roof only in EPSG 4326.
Coordinates must be in [longitude, latitude] order.
Include a properties object with pitchCategory one of low medium high.


You will be given the map center WGS84 coordinates and the Web Mercator tile parameters to convert pixels to lon lat:
center lat ${lat}
center lng ${lng}
zoom ${zoom}
size ${size} pixels square
Use standard Web Mercator math to convert pixel x y to lon lat. If unsure, approximate a rectangle around the evident roof.
Do not include extra text. Respond with pure JSON only.`;


const body = {
model: 'gpt-4o-mini',
messages: [
{ role:'system', content:'You analyze satellite images and output GeoJSON only.' },
{ role:'user', content:[
{ type:'text', text: prompt },
{ type:'input_image', image_url: imageUrl }
] }
],
temperature: 0.2,
response_format: { type:'json_object' }
};


const r = await fetch('https://api.openai.com/v1/chat/completions', {
method:'POST',
headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${openaiKey}` },
body: JSON.stringify(body)
});


if (!r.ok){
const t = await r.text();
return res.status(r.status).json({ error:'OpenAI error', detail:t });
}


const j = await r.json();
let content = j.choices?.[0]?.message?.content || '';


// Try to parse. If it is not valid GeoJSON, return a basic rectangle.
let parsed = null;
try{ parsed = JSON.parse(content); }catch{}


if (!parsed || parsed.type !== 'Feature' || parsed.geometry?.type !== 'Polygon'){
const d = 0.00012;
parsed = {
type:'Feature',
properties:{ pitchCategory:'low', source:'vision-fallback' },
geometry:{ type:'Polygon', coordinates:[ [ [lng-d,lat-d],[lng+d,lat-d],[lng+d,lat+d],[lng-d,lat+d],[lng-d,lat-d] ] ] }
};
}


return res.status(200).json(parsed);
}catch(e){
return res.status(500).json({ error:String(e) });
}
}
