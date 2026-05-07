async function callAnthropic(body) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

const FOCUS_KEYWORDS = {
  all: 'data science, AI/ML, mathematics, statistics, mathematical modelling, STEM',
  'data science': 'data science, data analysis, analytics, statistical modelling',
  'AI machine learning': 'artificial intelligence, machine learning, deep learning, NLP',
  'mathematics statistics research': 'mathematics, statistics, mathematical modelling, applied mathematics',
  'epidemiology modelling': 'epidemiological modelling, mathematical biology, infectious disease modelling',
  'software engineering': 'software engineering, software development, web development',
  STEM: 'STEM, science, technology, engineering, mathematics',
};

const TYPE_KEYWORDS = {
  all: 'internships, fellowships, research programs, scholarships',
  internship: 'internships, summer internships',
  fellowship: 'fellowships, scholarships, funded programs',
  'research program': 'research programs, REU, summer research, undergraduate research',
};

const REGION_KEYWORDS = {
  all: 'global — open to Nigerian/African students',
  international: 'international, open to all nationalities',
  USA: 'United States, American universities',
  'UK Europe': 'United Kingdom, Europe, Germany, France',
  'Africa Nigeria': 'Africa, Nigeria, pan-African programs',
  remote: 'remote, virtual, online',
};

const SEARCH_ANGLES = [
  {
    label: 'Global Tech & International Orgs',
    sources: 'Google, Microsoft, Meta, IBM, Amazon, UN, UNDP, UNESCO, World Bank, IMF, WHO, NASA, ESA, Gates Foundation, Fulbright, Commonwealth Scholarship, Chevening, DAAD, British Council',
  },
  {
    label: 'Africa-Focused Programs',
    sources: 'Tony Elumelu Foundation, AIMS, Mastercard Foundation, African Development Bank, African Union, Mo Ibrahim Foundation, YALI, NITDA, MTN Foundation, CcHUB, AfriLabs, Access Bank, Stanbic IBTC',
  },
  {
    label: 'Universities & Job Boards',
    sources: 'US REU programs, UK university research internships, ETH Zurich, EPFL, OIST Japan, LinkedIn Jobs, AfterSchoolAfrica, OpportunityDesk, scholars4dev, idealist.org, jobs.ac.uk, Glassdoor, Indeed, Handshake, IEEE, SIAM',
  },
];

function parseOpportunities(data) {
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  // Try direct parse first
  try {
    const p = JSON.parse(text.trim());
    if (Array.isArray(p)) return p;
    if (Array.isArray(p.opportunities)) return p.opportunities;
  } catch (_) {}

  // Try extracting JSON object
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s !== -1 && e !== -1) {
    try {
      const p = JSON.parse(text.slice(s, e + 1));
      if (Array.isArray(p.opportunities)) return p.opportunities;
      if (Array.isArray(p)) return p;
    } catch (_) {}
  }

  // Try extracting JSON array
  const sa = text.indexOf('['), ea = text.lastIndexOf(']');
  if (sa !== -1 && ea !== -1) {
    try { return JSON.parse(text.slice(sa, ea + 1)); } catch (_) {}
  }

  return [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { focus = 'all', type = 'all', region = 'all' } = req.body || {};
  const seed = Date.now();

  const profile = `Samuel Adegboyega | Nigerian | Univ. of Lagos | B.Sc. Industrial Mathematics Final Year 2026 | GPA 4.90/5.0 | Python R SQL Pandas TensorFlow Power BI | NITDA Data Science Cert | Led EIRS Ebola ODE modelling | VP PESSA | Open to any region paid/unpaid. Focus: ${FOCUS_KEYWORDS[focus] || FOCUS_KEYWORDS.all}. Type: ${TYPE_KEYWORDS[type] || TYPE_KEYWORDS.all}. Region: ${REGION_KEYWORDS[region] || REGION_KEYWORDS.all}. Seed:${seed}`;

  // 3 parallel searches — each targets a different source category
  const searches = SEARCH_ANGLES.map(({ label, sources }) =>
    callAnthropic({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `List 3 REAL opportunities for this student from these sources: ${sources}

${profile}

Return ONLY valid JSON, no markdown:
{"opportunities":[{"title":"","org":"","type":"internship|fellowship|research|program","description":"1 sentence","deadline":"month/year or Rolling","location":"City Country or Remote","paid":true,"stipend":"amount or Unpaid","eligibility":"one sentence","url":"https://...","match_reason":"one sentence","source":"${label}"}]}`,
      }],
    })
      .then(parseOpportunities)
      .catch(err => ({ __error: err.message }))
  );

  try {
    const results = await Promise.all(searches);

    // Surface errors if all calls failed
    const errors = results.filter(r => r && r.__error);
    if (errors.length === results.length) {
      return res.status(500).json({ error: errors[0].__error });
    }

    const all = results.filter(r => Array.isArray(r)).flat();

    // Deduplicate by title (case-insensitive)
    const seen = new Set();
    const unique = all.filter(opp => {
      if (!opp || typeof opp !== 'object') return false;
      const key = (opp.title || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!unique.length) {
      // Return partial errors for debugging
      const errMsgs = errors.map(e => e.__error).join(' | ');
      return res.status(500).json({
        error: `No results parsed. ${errMsgs || 'Check API key in Vercel environment variables.'}`,
      });
    }

    return res.json({ opportunities: unique });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
