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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { opportunity } = req.body || {};
  if (!opportunity) {
    return res.status(400).json({ error: 'opportunity is required' });
  }

  const prompt = `Write a tailored professional cover letter.

APPLICANT:
Name: Samuel Adegboyega
University: University of Lagos, Nigeria
Degree: B.Sc. Industrial Mathematics, 400 Level (Final Year, graduating June 2026)
GPA: 4.90/5.0 (First Class)
Skills: Python, R, SQL, JavaScript, Pandas, NumPy, Matplotlib, Seaborn, Plotly, Power BI, Excel, TensorFlow, Git
Experience:
- Vice President, PESSA (Physical and Earth Sciences Students Association), 2025-Present. Founded PIC 2026 innovation competition.
- EIRS Mathematical Model of Ebola Virus Disease — Team Lead. ODE formulation, primary data collection at LUTH, non-dimensionalisation, stability analysis.
- Private Mathematics Tutor, 2024-Present.
Certification: NITDA Data Science Professional Certificate (Coursera, April 2026).

OPPORTUNITY:
Title: ${opportunity.title}
Organisation: ${opportunity.org}
Type: ${opportunity.type}
Description: ${opportunity.description}
Location: ${opportunity.location || 'TBD'}

Write 3–4 paragraphs in first person as Samuel. Professional but warm. Reference specific matching skills, VP/PESSA leadership, PIC 2026, and EIRS Ebola modelling where relevant. End with a clear call to action. No placeholder brackets. Do not mention AI.`;

  try {
    const data = await callAnthropic({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.json({ coverLetter: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
