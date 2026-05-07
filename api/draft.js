import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

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
- Vice President, PESSA (Physical and Earth Sciences Students Association), University of Lagos, 2025-Present. Founded and leads PIC 2026 innovation competition from scratch.
- EIRS Mathematical Model of Ebola Virus Disease — Team Lead. Primary data collection at LUTH, ODE formulation, compartmental flow diagram, non-dimensionalisation, stability analysis.
- Private Mathematics Tutor, 2024-Present.
Certification: NITDA Data Science Professional Certificate (Coursera, April 2026) — covers Python, SQL, Pandas, ML regression, data visualisation, interactive dashboards.

OPPORTUNITY:
Title: ${opportunity.title}
Organisation: ${opportunity.org}
Type: ${opportunity.type}
Description: ${opportunity.description}
Location: ${opportunity.location || 'TBD'}

Write 3–4 paragraphs in first person as Samuel. Be professional but warm. Reference specific skills and experience that match this particular role. Mention his VP/PESSA leadership and the PIC 2026 innovation competition naturally. Reference his EIRS Ebola modelling research where relevant. End with a clear call to action. Do not use placeholder brackets — write the complete, final letter. Do not mention AI.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = (message.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    return res.json({ coverLetter: text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
