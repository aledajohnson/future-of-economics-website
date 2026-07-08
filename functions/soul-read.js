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
    leftStmt: "Firms, capital, and the tools of production are best held as private property.",
    rightStmt: "The means of production should be owned in common by the workers and communities who depend on them." },
  { name: 'Land & Rent',
    leftStmt: "Land and natural resources are property like anything else: own them, trade them.",
    rightStmt: "No one made the earth; what nature provides should benefit everyone." },
  { name: 'Growth',
    leftStmt: "Environmental challenges are best solved by growing the economy to fund technological breakthroughs.",
    rightStmt: "Environmental challenges are best solved by moving away from a growth-dependent economy entirely." },
  { name: 'The Goal',
    leftStmt: "We should measure economic success primarily by GDP growth, productivity, and market output.",
    rightStmt: "We should measure economic success primarily by human wellbeing and social equity." },
  { name: 'Public Spending',
    leftStmt: "Governments should keep budgets lean and balanced, spending only what tax revenue allows.",
    rightStmt: "Governments should spend actively, even running deficits, to drive full employment and invest in public research and infrastructure." },
];

export async function onRequestPost(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const { sliders, ranked } = await context.request.json();

    const key = context.env.ANTHROPIC_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: 'missing key' }), { status: 500, headers: corsHeaders });
    }

    const sliderLines = sliders.map((val, i) => {
      const s = SLIDERS[i];
      const pct = Math.round(val);
      let lean;
      if (pct < 30) lean = `strongly toward: "${s.leftStmt}"`;
      else if (pct > 70) lean = `strongly toward: "${s.rightStmt}"`;
      else if (pct < 45) lean = `leaning toward: "${s.leftStmt}"`;
      else if (pct > 55) lean = `leaning toward: "${s.rightStmt}"`;
      else lean = `squarely between: "${s.leftStmt}" / "${s.rightStmt}"`;
      return `- ${s.name} (${pct}/100): ${lean}`;
    }).join('\n');

    const topSchools = ranked.slice(0, 3).map((r, i) => `${i + 1}. ${r.name} (${r.pct}%)`).join(', ');

    const prompt = `You are writing a short personalized readout for a visitor at an interactive art installation at the Future of Us Festival in San Francisco. The visitor just moved 8 sliders to calibrate their economic worldview. Their responses:

${sliderLines}

Their closest coordinates: ${topSchools}

Write exactly 2-3 sentences to this person. Describe what their specific combination of answers reveals about what they value, grounded in their actual responses. Be observational and precise, not validating or cheerleading. Do not use the words tension, contradiction, or conflict. Be professional and clear. Address the person directly using "you" or "you've". Do not begin the first sentence with the word "Your". No preamble, no quotation marks. The — character is forbidden. Use only commas or periods to connect ideas.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';

    return new Response(JSON.stringify({ text }), { headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
