export const config = { runtime: 'edge' };

const FOCUS_KEYWORDS = {
  all: 'data science OR "artificial intelligence" OR "machine learning" OR mathematics OR statistics OR "mathematical modelling"',
  'data science': '"data science" OR "data analysis" OR analytics OR "statistical modelling"',
  'AI machine learning': '"artificial intelligence" OR "machine learning" OR "deep learning" OR "neural networks" OR NLP',
  'mathematics statistics research': 'mathematics OR statistics OR "mathematical modelling" OR "applied mathematics" OR "mathematical biology"',
  'epidemiology modelling': '"epidemiological modelling" OR "mathematical biology" OR "disease modelling" OR "infectious disease"',
  'software engineering': '"software engineering" OR "software development" OR "web development" OR "full stack"',
  STEM: 'STEM OR science OR technology OR engineering OR mathematics OR "research program"',
};

const TYPE_KEYWORDS = {
  all: 'internship OR fellowship OR "research program" OR scholarship OR "research experience"',
  internship: 'internship OR "intern program" OR "summer internship"',
  fellowship: 'fellowship OR scholarship OR "funded program" OR "research fellowship"',
  'research program': '"research program" OR "research experience" OR REU OR "summer research" OR "undergraduate research"',
};

const REGION_KEYWORDS = {
  all: 'international OR worldwide OR global OR USA OR UK OR Europe OR Africa OR remote',
  international: 'international OR global OR "open to international students" OR "all nationalities"',
  USA: '"United States" OR USA OR American',
  'UK Europe': '"United Kingdom" OR UK OR Europe OR EU OR Germany OR France',
  'Africa Nigeria': 'Africa OR Nigeria OR "West Africa" OR "African students"',
  remote: 'remote OR virtual OR online OR "work from home" OR "fully remote"',
};

async function anthropic(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let focus = 'all', type = 'all', region = 'all';
  try {
    const body = await req.json();
    focus = body.focus || 'all';
    type = body.type || 'all';
    region = body.region || 'all';
  } catch (_) {}

  const systemPrompt = `You are an expert global opportunity researcher with access to web search.
Search WIDELY — LinkedIn, Glassdoor, Indeed, jobs.ac.uk, university career pages, NGO sites, opportunitydesk.org, afterschoolafrica.com, scholars4dev.com, idealist.org.
Your FINAL response MUST be ONLY raw valid JSON starting with { and ending with }. No markdown, no preamble.`;

  const userPrompt = `Find 10 REAL, CURRENTLY OPEN opportunities for this student.

STUDENT: Samuel Adegboyega | Nigerian | University of Lagos | B.Sc. Industrial Mathematics (Final Year, June 2026) | GPA 4.90/5.0 | Python, R, SQL, Pandas, TensorFlow, Power BI | NITDA Data Science Cert (2026) | Led EIRS Ebola mathematical modelling (ODE, LUTH data) | VP PESSA, founded PIC 2026 competition | Open to paid/unpaid, remote/in-person, any region.

FOCUS: ${FOCUS_KEYWORDS[focus] || FOCUS_KEYWORDS.all}
TYPE: ${TYPE_KEYWORDS[type] || TYPE_KEYWORDS.all}
REGION: ${REGION_KEYWORDS[region] || REGION_KEYWORDS.all}

Return ONLY this JSON:
{"opportunities":[{"title":"","org":"","type":"internship|fellowship|research|program","description":"2 sentences","deadline":"date or Rolling","location":"City Country or Remote","paid":true,"stipend":"amount or Unpaid","eligibility":"one sentence","url":"https://...","match_reason":"why this fits Samuel","source":"which platform"}]}`;

  try {
    let messages = [{ role: 'user', content: userPrompt }];
    let data = await anthropic({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    let loops = 0;
    while (data.stop_reason === 'tool_use' && loops < 4) {
      loops++;
      const toolResults = (data.content || [])
        .filter(b => b.type === 'tool_use')
        .map(b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: JSON.stringify(b.output || b.result || '{}'),
        }));

      messages = [
        ...messages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults },
      ];

      data = await anthropic({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages,
      });
    }

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let parsed = null;
    try { parsed = JSON.parse(text.trim()); } catch (_) {}
    if (!parsed) {
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        try { parsed = JSON.parse(text.slice(s, e + 1)); } catch (_) {}
      }
    }

    if (!parsed?.opportunities) {
      return new Response(JSON.stringify({ error: 'Could not parse results. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
