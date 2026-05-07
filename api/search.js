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
  all: 'data science, AI/ML, mathematics, statistics, mathematical modelling, STEM research, computational mathematics',
  'data science': 'data science, data analysis, big data, analytics, statistical modelling',
  'AI machine learning': 'artificial intelligence, machine learning, deep learning, neural networks, NLP, computer vision',
  'mathematics statistics research': 'mathematics, statistics, mathematical modelling, applied mathematics, mathematical biology, numerical analysis',
  'epidemiology modelling': 'epidemiological modelling, mathematical biology, disease modelling, compartmental models, infectious disease, bioinformatics',
  'software engineering': 'software engineering, software development, web development, full stack, backend, frontend',
  STEM: 'STEM, science, technology, engineering, mathematics, interdisciplinary research',
};

const TYPE_KEYWORDS = {
  all: 'internships, fellowships, research programs, scholarships, research experience programs',
  internship: 'internships, intern programs, summer internships, research internships',
  fellowship: 'fellowships, scholarships, funded programs, research fellowships, graduate fellowships',
  'research program': 'research programs, research experience programs, REU, summer research, undergraduate research, visiting researcher programs',
};

const REGION_KEYWORDS = {
  all: 'international, global, USA, UK, Europe, Africa, remote — open to Nigerian students',
  international: 'international, global, open to all nationalities, worldwide',
  USA: 'United States, USA, American universities and organisations',
  'UK Europe': 'United Kingdom, UK, Europe, EU, Germany, France, Netherlands, Sweden',
  'Africa Nigeria': 'Africa, Nigeria, West Africa, African students, sub-Saharan Africa, ECOWAS',
  remote: 'remote, virtual, online, work from home, fully remote, hybrid',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { focus = 'all', type = 'all', region = 'all' } = req.body || {};

  const prompt = `You are an expert opportunity advisor for STEM students from Africa. List 10 REAL, well-known opportunities that Samuel should apply to. Use your knowledge of actual programs — include real application URLs.

STUDENT PROFILE:
- Samuel Adegboyega, Nigerian, University of Lagos
- B.Sc. Industrial Mathematics, Final Year (graduating June 2026), GPA 4.90/5.0 (First Class)
- Skills: Python, R, SQL, Pandas, NumPy, Matplotlib, Seaborn, Plotly, Power BI, Excel, TensorFlow, Git
- Certification: NITDA Data Science Professional (Coursera, April 2026)
- Research: Led EIRS Ebola mathematical modelling — ODE formulation, data collection at LUTH, stability analysis
- Leadership: VP of PESSA, founded PIC 2026 innovation competition
- Open to: paid or unpaid, remote or in-person, willing to relocate internationally

FOCUS AREAS: ${FOCUS_KEYWORDS[focus] || FOCUS_KEYWORDS.all}
OPPORTUNITY TYPES: ${TYPE_KEYWORDS[type] || TYPE_KEYWORDS.all}
REGIONS: ${REGION_KEYWORDS[region] || REGION_KEYWORDS.all}

Include a diverse mix — think: DAAD, Tony Elumelu Foundation, AIMS, World Bank YPP, Google, UN, Mastercard Foundation, African Development Bank, NASA, university research programs, NGOs, and lesser-known but legitimate programs specifically open to Nigerian/African students.

Return ONLY this JSON — no markdown, no explanation, nothing outside the JSON:
{"opportunities":[{"title":"exact program name","org":"full organisation name","type":"internship|fellowship|research|program","description":"2 sentences about the program and what Samuel would do","deadline":"typical deadline month/year or Rolling","location":"City Country or Remote","paid":true,"stipend":"amount or Unpaid or Varies","eligibility":"one sentence","url":"https://real-url.com","match_reason":"why this specifically fits Samuel","source":"org website or known platform"}]}`;

  try {
    const data = await callAnthropic({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

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
      return res.status(500).json({ error: 'Could not parse results. Please try again.' });
    }

    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
