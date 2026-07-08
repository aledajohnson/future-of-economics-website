// Local event server — serves the site and proxies /soul-read to Anthropic.
// Usage: node server.js   (reads ANTHROPIC_API_KEY from .env)
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Parse .env file
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split('\n').forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k) process.env[k] = v;
    });
} catch (_) {}

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

const SLIDERS = [
  { name: 'Theory of Value',
    leftStmt: "A thing's true worth comes from the labor and resources poured into making it.",
    rightStmt: "A thing is worth exactly what someone will pay for it." },
  { name: 'Regulation',
    leftStmt: "Markets sort themselves out. Supply and demand create proper balance.",
    rightStmt: "Government should actively steer. Markets need a guiding hand." },
  { name: 'Power & the State',
    leftStmt: "Public institutions are how we solve problems too big for any of us alone.",
    rightStmt: "Concentrated power, whether state or corporate, is the problem, not the solution." },
  { name: 'Ownership',
    leftStmt: "Productive wealth, including land, firms, and capital, is best held as private property.",
    rightStmt: "The things we all depend on should be owned in common by those who use them." },
  { name: 'Land & Rent',
    leftStmt: "Land and natural resources are property like anything else: own them, trade them.",
    rightStmt: "No one made the earth; what nature provides should benefit everyone." },
  { name: 'Growth',
    leftStmt: "A prosperous society is a growing one: more output, more abundance, more progress.",
    rightStmt: "Endless growth on a finite planet is the illusion; health means living within limits." },
  { name: 'The Goal',
    leftStmt: "Get the economy producing as much as possible, as efficiently as possible.",
    rightStmt: "Measure success by human and ecological wellbeing, not by how much we produce." },
];

function buildPrompt(sliders, ranked) {
  const lines = sliders.map((val, i) => {
    const s = SLIDERS[i];
    const pct = Math.round(val);
    let lean;
    if (pct < 30)      lean = `strongly toward: "${s.leftStmt}"`;
    else if (pct > 70) lean = `strongly toward: "${s.rightStmt}"`;
    else if (pct < 45) lean = `leaning toward: "${s.leftStmt}"`;
    else if (pct > 55) lean = `leaning toward: "${s.rightStmt}"`;
    else               lean = `squarely between: "${s.leftStmt}" / "${s.rightStmt}"`;
    return `- ${s.name} (${pct}/100): ${lean}`;
  }).join('\n');

  const top = ranked.slice(0, 3).map((r, i) => `${i + 1}. ${r.name} (${r.pct}%)`).join(', ');

  return `You are writing a short personalized readout for a visitor at A.G.E.N.C.Y., an interactive art installation at the Future of Us Festival in San Francisco. The visitor just moved 7 sliders to calibrate their economic worldview. Their responses:\n\n${lines}\n\nTheir closest coordinates: ${top}\n\nWrite exactly 2-3 sentences directly to this person. Focus on what their SPECIFIC combination of answers reveals — not a textbook description of the top school. Look for tensions, contradictions, or surprising alignments in their answers. What do these choices together say about what they actually value? Be direct and human, no jargon. Do not start with "Your" — vary the opening. No preamble, no quotation marks around the response.`;
}

function callAnthropic(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', c => buf += c);
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

http.createServer(async (req, res) => {
  // AI proxy endpoint
  if (req.method === 'POST' && req.url === '/soul-read') {
    try {
      const { sliders, ranked } = JSON.parse(await readBody(req));
      if (!API_KEY) throw new Error('ANTHROPIC_API_KEY not set in .env');
      const data = await callAnthropic(buildPrompt(sliders, ranked));
      const text = data.content?.[0]?.text?.trim() || '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  // Static file server
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(__dirname, urlPath);

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }

}).listen(PORT, () => {
  console.log(`\nA.G.E.N.C.Y. running at http://localhost:${PORT}`);
  if (!API_KEY) console.warn('  ⚠  ANTHROPIC_API_KEY not found in .env — AI readout will fall back to static blurb\n');
  else console.log('  ✓  ANTHROPIC_API_KEY loaded — AI readout active\n');
});
