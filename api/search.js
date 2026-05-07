import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const FOCUS_KEYWORDS = {
  all: 'data science OR "artificial intelligence" OR "machine learning" OR mathematics OR statistics OR "STEM research" OR "mathematical modelling" OR "computational mathematics"',
  'data science': '"data science" OR "data analysis" OR "big data" OR analytics OR "statistical modelling" OR "data engineering"',
  'AI machine learning': '"artificial intelligence" OR "machine learning" OR "deep learning" OR "neural networks" OR NLP OR "computer vision" OR "AI research"',
  'mathematics statistics research': 'mathematics OR statistics OR "mathematical modelling" OR "applied mathematics" OR "computational mathematics" OR "mathematical biology" OR "numerical analysis"',
  'epidemiology modelling': '"epidemiological modelling" OR "mathematical biology" OR "disease modelling" OR "compartmental model" OR "infectious disease" OR bioinformatics',
  'software engineering': '"software engineering" OR "software development" OR "web development" OR "full stack" OR "backend" OR "software intern"',
  STEM: 'STEM OR science OR technology OR engineering OR mathematics OR "research program" OR "undergraduate research"',
};

const TYPE_KEYWORDS = {
  all: 'internship OR fellowship OR "research program" OR scholarship OR "research experience" OR "summer program"',
  internship: 'internship OR "intern program" OR "summer internship" OR "research internship"',
  fellowship: 'fellowship OR scholarship OR "funded program" OR "graduate fellowship" OR "research fellowship"',
  'research program': '"research program" OR "research experience" OR REU OR "summer research" OR "undergraduate research" OR "visiting researcher"',
};

const REGION_KEYWORDS = {
  all: 'international OR worldwide OR global OR USA OR UK OR Europe OR Africa OR remote OR online',
  international: 'international OR global OR "open to international students" OR "all nationalities" OR worldwide',
  USA: '"United States" OR USA OR American OR "US-based"',
  'UK Europe': '"United Kingdom" OR UK OR Europe OR EU OR Germany OR France OR Netherlands OR Sweden',
  'Africa Nigeria': 'Africa OR Nigeria OR "West Africa" OR "African students" OR "sub-Saharan Africa"',
  remote: 'remote OR virtual OR online OR "work from home" OR "fully remote" OR hybrid',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { focus = 'all', type = 'all', region = 'all' } = req.body || {};

  const systemPrompt = `You are an expert global opportunity researcher with access to web search.
Search WIDELY across the entire internet — LinkedIn jobs, Glassdoor, Indeed, jobs.ac.uk, university career pages, NGO sites, tech company career portals, and opportunity aggregators (opportunitydesk.org, afterschoolafrica.com, scholars4dev.com, aiesec.org, idealist.org).
Cast the widest possible net. Do NOT limit yourself to well-known programs only.
Your FINAL response MUST be ONLY raw valid JSON starting with { and ending with }. No markdown. No explanation. No preamble.`;

  const userPrompt = `Search broadly and deeply across the entire internet and find 10 REAL, CURRENTLY OPEN OR UPCOMING opportunities for this student.

STUDENT PROFILE:
- Name: Samuel Adegboyega
- Nationality: Nigerian, based in Lagos
- University: University of Lagos
- Degree: B.Sc. Industrial Mathematics, Final Year (graduating June 2026)
- GPA: 4.90 / 5.0 (First Class)
- Skills: Python, R, SQL, Pandas, NumPy, Matplotlib, Seaborn, Plotly, Power BI, Excel, TensorFlow, Git
- Certification: NITDA Data Science Professional (Coursera, April 2026)
- Research: Led EIRS Ebola mathematical modelling — ODE formulation, primary data from LUTH, non-dimensionalisation, stability analysis
- Leadership: VP of PESSA (Physical and Earth Sciences Students Association), founded PIC 2026 innovation competition
- Open to: paid or unpaid, remote or in-person, any region, willing to relocate internationally

SEARCH FOCUS: ${FOCUS_KEYWORDS[focus] || FOCUS_KEYWORDS.all}
OPPORTUNITY TYPE: ${TYPE_KEYWORDS[type] || TYPE_KEYWORDS.all}
REGION: ${REGION_KEYWORDS[region] || REGION_KEYWORDS.all}

Search across LinkedIn, job boards (Indeed, Glassdoor, jobs.ac.uk), university sites, AfterSchoolAfrica, OpportunityDesk, scholars4dev, and major org career pages (NASA, Google, UN, World Bank, DAAD, AIMS, Tony Elumelu Foundation).
Prioritise programs explicitly open to Nigerian or international students. Include both well-known and lesser-known but legitimate programs.

Return ONLY this JSON — nothing else, no markdown:
{"opportunities":[{"title":"exact program name","org":"full organisation name","type":"internship|fellowship|research|program","description":"2 sentences about the program and what Samuel would do","deadline":"exact date or Rolling or Check website","location":"City Country or Remote","paid":true,"stipend":"amount or Unpaid or TBD","eligibility":"one sentence","url":"https://real-url.com","match_reason":"why this fits Samuel specifically","source":"which site/platform you found this on"}]}`;

  try {
    let messages = [{ role: 'user', content: userPrompt }];
    let data = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 5000,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    let loops = 0;
    while (data.stop_reason === 'tool_use' && loops < 8) {
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

      data = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 5000,
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
      const s = text.indexOf('{');
      const e = text.lastIndexOf('}');
      if (s !== -1 && e !== -1) {
        try { parsed = JSON.parse(text.slice(s, e + 1)); } catch (_) {}
      }
    }

    if (!parsed) {
      const s = text.indexOf('[');
      const e = text.lastIndexOf(']');
      if (s !== -1 && e !== -1) {
        try { parsed = { opportunities: JSON.parse(text.slice(s, e + 1)) }; } catch (_) {}
      }
    }

    if (!parsed?.opportunities) {
      return res.status(500).json({
        error: 'Could not parse opportunities from AI response.',
        raw: text.slice(0, 500),
      });
    }

    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
