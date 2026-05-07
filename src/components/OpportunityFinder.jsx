import { useState, useEffect, useRef } from 'react';

const STEP_MESSAGES = [
  'Searching across the internet...',
  'Scanning NASA, UN, Google, World Bank...',
  'Checking opportunity databases...',
  'Searching AfterSchoolAfrica, OpportunityDesk...',
  'Filtering for your profile and skills...',
  'Verifying deadlines and eligibility...',
  'Compiling your results...',
];

const TYPE_CLASS = {
  internship: 'type-internship',
  fellowship: 'type-fellowship',
  research: 'type-research',
  program: 'type-program',
};

function OpportunityCard({ opp, index, onDraft }) {
  const typeClass = TYPE_CLASS[(opp.type || '').toLowerCase()] || 'type-program';
  const deadlineLower = (opp.deadline || '').toLowerCase();
  const isUrgent = deadlineLower.includes('soon') || deadlineLower.includes('closing');

  return (
    <div className="opp-card" style={{ animationDelay: `${index * 0.06}s` }}>
      <div className="card-top">
        <div className="card-title">{opp.title || 'Untitled'}</div>
        <span className={`card-type ${typeClass}`}>
          {(opp.type || 'program').toUpperCase()}
        </span>
      </div>

      <div className="card-org">
        📍 <strong>{opp.org}</strong> · {opp.location || 'TBD'}
      </div>

      <div className="card-desc">{opp.description}</div>

      <div className="card-meta">
        {opp.deadline && (
          <span className={`meta-tag ${isUrgent ? 'urgent' : 'deadline'}`}>
            🗓 {opp.deadline}
          </span>
        )}
        {opp.paid
          ? <span className="meta-tag paid">💰 {opp.stipend || 'Paid'}</span>
          : <span className="meta-tag">Unpaid</span>
        }
        {opp.eligibility && <span className="meta-tag">👤 {opp.eligibility}</span>}
        {opp.source && <span className="meta-tag">🔗 {opp.source}</span>}
      </div>

      {opp.match_reason && (
        <div style={{ fontSize: '12px', color: 'rgba(0,255,136,0.7)', marginBottom: '14px', fontStyle: 'italic' }}>
          ✦ {opp.match_reason}
        </div>
      )}

      <div className="card-actions">
        {opp.url && (
          <a className="btn-apply" href={opp.url} target="_blank" rel="noopener noreferrer">
            Apply ↗
          </a>
        )}
        <button className="btn-draft" onClick={() => onDraft(opp)}>
          ✍ Draft Cover Letter
        </button>
      </div>
    </div>
  );
}

function DraftModal({ opp, onClose }) {
  const [loading, setLoading] = useState(true);
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        const res = await fetch('/api/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ opportunity: opp }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to generate cover letter');
        if (!cancelled) setCoverLetter(data.coverLetter);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    generate();
    return () => { cancelled = true; };
  }, [opp]);

  const copy = () => {
    navigator.clipboard.writeText(coverLetter).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Cover Letter — {opp.title}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div className="draft-loading">
              <div className="mini-loader" />
              Writing your tailored cover letter...
            </div>
          )}
          {error && (
            <div style={{ color: 'var(--red)', fontSize: '13px' }}>⚠ {error}</div>
          )}
          {coverLetter && (
            <>
              <div className="draft-output">{coverLetter}</div>
              <button className="copy-draft-btn" onClick={copy}>
                {copied ? '✓ Copied!' : '📋 Copy to clipboard'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpportunityFinder() {
  const [focus, setFocus] = useState('all');
  const [type, setType] = useState('all');
  const [region, setRegion] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(STEP_MESSAGES[0]);
  const [opportunities, setOpportunities] = useState([]);
  const [error, setError] = useState(null);
  const [clock, setClock] = useState('');
  const [draftOpp, setDraftOpp] = useState(null);
  const [searched, setSearched] = useState(false);
  const stepIntervalRef = useRef(null);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const runSearch = async () => {
    setLoading(true);
    setOpportunities([]);
    setError(null);
    setSearched(true);

    let stepIdx = 0;
    setLoadingStep(STEP_MESSAGES[0]);
    stepIntervalRef.current = setInterval(() => {
      stepIdx++;
      setLoadingStep(STEP_MESSAGES[stepIdx % STEP_MESSAGES.length]);
    }, 3000);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus, type, region }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Search failed');
      if (!data.opportunities?.length) throw new Error('No opportunities found. Try different filters.');

      setOpportunities(data.opportunities);
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(stepIntervalRef.current);
      setLoading(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div className="logo-dot" />
          <div className="logo-text">OPPORTUNITY_FINDER.exe</div>
        </div>
        <div className="topbar-right">{clock}</div>
      </div>

      <div className="main">
        <div className="hero">
          <div className="hero-tag">Daily Search System</div>
          <h1>Find Your Next<br /><em>Big Opportunity</em></h1>
          <p>
            Searches the internet for internships, fellowships, and research programs
            matched to your profile. Pick your filters and hit search — results are always fresh.
          </p>
        </div>

        <div className="profile-strip">
          <div className="ps-item">👤 <strong>Samuel Adegboyega</strong></div>
          <div className="ps-item">🎓 <strong>Industrial Mathematics, UNILAG · Final Year</strong></div>
          <div className="ps-item">⭐ <strong>GPA 4.90/5.0 (First Class)</strong></div>
          <div className="ps-item">🛠 <strong>Python · R · SQL · Pandas · Power BI · TensorFlow</strong></div>
          <div className="ps-item">📜 <strong>NITDA Data Science Professional (Coursera 2026)</strong></div>
          <div className="ps-item">🔬 <strong>EIRS Ebola Modelling Research — Team Lead</strong></div>
          <div className="ps-item">🌍 <strong>Open to international · Remote or In-person</strong></div>
        </div>

        <div className="search-area">
          <select
            className="filter-select"
            value={focus}
            onChange={e => setFocus(e.target.value)}
          >
            <option value="all">All Focus Areas</option>
            <option value="data science">Data Science</option>
            <option value="AI machine learning">AI / Machine Learning</option>
            <option value="mathematics statistics research">Mathematics / Research</option>
            <option value="epidemiology modelling">Epidemiology / Mathematical Biology</option>
            <option value="software engineering">Software Engineering</option>
            <option value="STEM">STEM General</option>
          </select>

          <select
            className="filter-select"
            value={type}
            onChange={e => setType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="internship">Internships</option>
            <option value="fellowship">Fellowships</option>
            <option value="research program">Research Programs</option>
          </select>

          <select
            className="filter-select"
            value={region}
            onChange={e => setRegion(e.target.value)}
          >
            <option value="all">All Regions</option>
            <option value="international">International</option>
            <option value="USA">USA</option>
            <option value="UK Europe">UK / Europe</option>
            <option value="Africa Nigeria">Africa / Nigeria</option>
            <option value="remote">Remote</option>
          </select>

          <button className="search-btn" onClick={runSearch} disabled={loading}>
            <span>🔍</span>
            {loading ? 'Searching...' : 'Search Opportunities'}
          </button>
        </div>

        {loading && (
          <div className="loading">
            <div className="loader-ring" />
            <div className="loading-text">SCANNING THE INTERNET...</div>
            <div className="loading-steps">{loadingStep}</div>
          </div>
        )}

        {error && !loading && (
          <div className="error-box">⚠ {error}</div>
        )}

        {opportunities.length > 0 && (
          <>
            <div className="results-header">
              <div className="results-title">// RESULTS</div>
              <div className="results-count">
                {opportunities.length} found ·{' '}
                {new Date().toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </div>
            </div>
            {opportunities.map((opp, i) => (
              <OpportunityCard
                key={i}
                opp={opp}
                index={i}
                onDraft={setDraftOpp}
              />
            ))}
          </>
        )}

        {!loading && !error && !searched && (
          <div className="empty">
            <div className="icon">🔭</div>
            <p>
              Select your focus area, type, and region above,<br />
              then click Search to find opportunities matched to your profile.
            </p>
          </div>
        )}
      </div>

      {draftOpp && (
        <DraftModal opp={draftOpp} onClose={() => setDraftOpp(null)} />
      )}
    </>
  );
}
