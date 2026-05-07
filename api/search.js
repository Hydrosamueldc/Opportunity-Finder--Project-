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
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const FOCUS_KEYWORDS = {
  all: 'data science, AI/ML, mathematics, statistics, mathematical modelling, STEM research',
  'data science': 'data science, data analysis, big data, analytics, statistical modelling, BI',
  'AI machine learning': 'artificial intelligence, machine learning, deep learning, neural networks, NLP, computer vision',
  'mathematics statistics research': 'mathematics, statistics, mathematical modelling, applied mathematics, mathematical biology',
  'epidemiology modelling': 'epidemiological modelling, mathematical biology, disease modelling, compartmental models, infectious disease',
  'software engineering': 'software engineering, software development, web development, full stack, backend',
  STEM: 'STEM, science, technology, engineering, mathematics, interdisciplinary research',
};

const TYPE_KEYWORDS = {
  all: 'internships, fellowships, research programs, scholarships, research experience',
  internship: 'internships, summer internships, research internships',
  fellowship: 'fellowships, scholarships, funded programs, research fellowships',
  'research program': 'research programs, REU, summer research, undergraduate research',
};

const REGION_KEYWORDS = {
  all: 'international, global, USA, UK, Europe, Africa, remote — open to Nigerian students',
  international: 'international, global, open to all nationalities',
  USA: 'United States, USA, American universities and organisations',
  'UK Europe': 'United Kingdom, Europe, EU, Germany, France, Netherlands',
  'Africa Nigeria': 'Africa, Nigeria, West Africa, pan-African programs',
  remote: 'remote, virtual, online, fully remote, hybrid',
};

// Three parallel searches covering different source categories
const SEARCH_ANGLES = [
  {
    label: 'Global Tech & International Orgs',
    sources: 'Google, Microsoft, Meta, IBM, Amazon, Salesforce, UN, UNDP, UNESCO, UNICEF, World Bank, IMF, WHO, NASA, ESA, CERN, Max Planck Institute, Wellcome Trust, Gates Foundation, Fulbright, Commonwealth Scholarship, British Council, Chevening',
  },
  {
    label: 'Africa-Focused Programs',
    sources: 'Tony Elumelu Foundation, AIMS (African Institute of Mathematical Sciences), Mastercard Foundation, African Development Bank, African Union, Mo Ibrahim Foundation, NITDA, MTN Foundation, Access Bank, Stanbic IBTC, Dangote Foundation, TETFund, YALI, ECOWAS, AfriLabs, CcHUB, Co-Creation Hub',
  },
  {
    label: 'Universities, Research & Job Boards',
    sources: 'US university REU programs, UK university research internships, European DAAD scholarships, OIST Japan, ETH Zurich, EPFL, LinkedIn Jobs, Glassdoor, Indeed, AfterSchoolAfrica, OpportunityDesk, scholars4dev, idealist.org, jobs.ac.uk, ResearchGate, IEEE, SIAM, Royal Statistical Society, Handshake',
  },
];

function parseOpportunities(data) {
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s === -1 || e === -1) return [];
    const parsed = JSON.parse(text.slice(s, e + 1));
    return Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
  } catch (_) { return []; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { focus = 'all', type = 'all', region = 'all' } = req.body || {};
  const seed = Date.now(); // ensures different results each run

  const profile = `STUDENT: Samuel Adegboyega | Nigerian | University of Lagos | B.Sc. Industrial Mathematics (Final Year, June 2026) | GPA 4.90/5.0 First Class | Skills: Python, R, SQL, Pandas, NumPy, TensorFlow, Power BI, Git | NITDA Data Science Cert (2026) | Led EIRS Ebola ODE mathematical modelling at LUTH | VP PESSA, founded PIC 2026 | Open to any region, paid or unpaid.
FOCUS: ${FOCUS_KEYWORDS[focus] || FOCUS_KEYWORDS.all}
TYPE: ${TYPE_KEYWORDS[type] || TYPE_KEYWORDS.all}
REGION: ${REGION_KEYWORDS[region] || REGION_KEYWORDS.all}
RUN: ${seed}`;

  // Fire all 3 searches in parallel — each targets a different source category
  const searches = SEARCH_ANGLES.map(({ label, sources }) =>
    callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: `${profile}

Search specifically from these sources: ${sources}

Find 4 REAL opportunities with actual URLs. Return ONLY valid JSON:
{"opportunities":[{"title":"","org":"","type":"internship|fellowship|research|program","description":"1-2 sentences","deadline":"month/year or Rolling","location":"City Country or Remote","paid":true,"stipend":"amount or Unpaid","eligibility":"one sentence","url":"https://...","match_reason":"why fits Samuel","source":"${label}"}]}`,
      }],
    })
      .then(parseOpportunities)
      .catch(() => [])
  );

  try {
    const results = await Promise.all(searches);
    const all = results.flat();

    // Deduplicate by URL
    const seen = new Set();
    const unique = all.filter(opp => {
      const key = (opp.url || opp.title || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!unique.length) {
      return res.status(500).json({ error: 'No results found. Please try again.' });
    }

    return res.json({ opportunities: unique });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
