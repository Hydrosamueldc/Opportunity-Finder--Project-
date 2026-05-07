import { useState, useEffect, useRef } from 'react';

const FOCUS_OPTIONS = [
  { value: 'all', label: 'All Areas' },
  { value: 'data science', label: 'Data Science' },
  { value: 'AI machine learning', label: 'AI / ML' },
  { value: 'mathematics statistics research', label: 'Mathematics' },
  { value: 'epidemiology modelling', label: 'Epidemiology' },
  { value: 'software engineering', label: 'Software Eng' },
  { value: 'STEM', label: 'STEM' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'internship', label: 'Internships' },
  { value: 'fellowship', label: 'Fellowships' },
  { value: 'research program', label: 'Research' },
];

const REGION_OPTIONS = [
  { value: 'all', label: 'Anywhere' },
  { value: 'international', label: 'International' },
  { value: 'USA', label: 'USA' },
  { value: 'UK Europe', label: 'UK / Europe' },
  { value: 'Africa Nigeria', label: 'Africa' },
  { value: 'remote', label: 'Remote' },
];

const SCAN_SOURCES = [
  'LinkedIn Jobs', 'AfterSchoolAfrica', 'OpportunityDesk',
  'scholars4dev', 'Indeed', 'World Bank',
  'Google Careers', 'UN Jobs', 'DAAD',
  'Tony Elumelu Foundation', 'AIMS', 'Mastercard Foundation',
  'NASA', 'AfDB', 'idealist.org', 'jobs.ac.uk',
  'Fulbright', 'Chevening', 'ETH Zurich', 'Glassdoor',
];

const TYPE_CLASS = {
  internship: 'type-internship',
  fellowship: 'type-fellowship',
  research: 'type-research',
  program: 'type-program',
};

function Pill({ label, active, onClick }) {
  return (
    <button className={`filter-pill${active ? ' active' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  return (
    <div className="filter-group">
      <div className="filter-group-label">{label}</div>
      <div className="filter-pills">
        {options.map(opt => (
          <Pill
            key={opt.value}
            label={opt.label}
            active={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}

function ScanningLoader({ sources }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    setVisible([]);
    let i = 0;
    const id = setInterval(() => {
      setVisible(v => [...v, i]);
      i++;
      if (i >= sources.length) clearInterval(id);
    }, 200);
    return () => clearInterval(id);
  }, [sources]);

  return (
    <div className="loading">
      <div className="loader-ring" />
      <div className="loading-text">SCANNING SOURCES...</div>
      <div className="scan-grid">
        {sources.map((src, i) => (
          <span
            key={src}
            className={`scan-chip${visible.includes(i) ? ' visible' : ''}`}
          >
            {src}
          </span>
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({ opp, index, onDraft }) {
  const typeClass = TYPE_CLASS[(opp.type || '').toLowerCase()] || 'type-program';
  const deadlineLower = (opp.deadline || '').toLowerCase();
  const isUrgent = deadlineLower.includes('soon') || deadlineLower.includes('closing') || deadlineLower.includes('jul') || deadlineLower.includes('aug');

  return (
    <div className="opp-card" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="card-top">
        <div>
          <div className="card-title">{opp.title || 'Untitled'}</div>
          <div className="card-org">
            <strong>{opp.org}</strong> · {opp.location || 'TBD'}
          </div>
        </div>
        <span className={`card-type ${typeClass}`}>
          {(opp.type || 'program').toUpperCase()}
        </span>
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
        {opp.source && <span className="meta-tag source-tag">🔗 {opp.source}</span>}
      </div>

      {opp.match_reason && (
        <div className="match-reason">✦ {opp.match_reason}</div>
      )}

      <div className="card-actions">
        {opp.url && (
          <a className="btn-apply" href={opp.url} target="_blank" rel="noopener noreferrer">
            Apply ↗
          </a>
        )}
        <button className="btn-draft" onClick={() => onDraft(opp)}>
          ✍ Cover Letter
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
        const raw = await res.text();
        let data;
        try { data = JSON.parse(raw); } catch (_) {
          throw new Error(`Server error: ${raw.slice(0, 150)}`);
        }
        if (!res.ok) throw new Error(data.error || 'Failed');
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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Cover Letter</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{opp.org} · {opp.title}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {loading && (
            <div className="draft-loading">
              <div className="mini-loader" />
              Writing your tailored cover letter...
            </div>
          )}
          {error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>⚠ {error}</div>}
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
  const [opportunities, setOpportunities] = useState([]);
  const [error, setError] = useState(null);
  const [clock, setClock] = useState('');
  const [draftOpp, setDraftOpp] = useState(null);
  const [searched, setSearched] = useState(false);

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

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus, type, region }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch (_) {
        throw new Error(`Server error: ${raw.slice(0, 200)}`);
      }
      if (!res.ok) throw new Error(data.error || 'Search failed');
      if (!data.opportunities?.length) throw new Error('No results. Try different filters.');
      setOpportunities(data.opportunities);
    } catch (e) {
      setError(e.message);
    } finally {
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
          <div className="hero-tag">Multi-Source Search System</div>
          <h1>Find Your Next<br /><em>Big Opportunity</em></h1>
          <p>
            Searches across LinkedIn, AfterSchoolAfrica, OpportunityDesk, scholars4dev,
            World Bank, Google, UN, Tony Elumelu Foundation, DAAD, and 40+ other sources —
            matched to your profile.
          </p>
        </div>

        <div className="profile-strip">
          <div className="ps-item">👤 <strong>Samuel Adegboyega</strong></div>
          <div className="ps-item">🎓 <strong>Industrial Mathematics, UNILAG · Final Year</strong></div>
          <div className="ps-item">⭐ <strong>GPA 4.90/5.0 (First Class)</strong></div>
          <div className="ps-item">🛠 <strong>Python · R · SQL · Pandas · Power BI · TensorFlow</strong></div>
          <div className="ps-item">📜 <strong>NITDA Data Science Professional (2026)</strong></div>
          <div className="ps-item">🔬 <strong>EIRS Ebola Modelling — Team Lead</strong></div>
          <div className="ps-item">🌍 <strong>Open to international · Remote or In-person</strong></div>
        </div>

        <div className="filters-section">
          <FilterGroup
            label="Focus Area"
            options={FOCUS_OPTIONS}
            value={focus}
            onChange={setFocus}
          />
          <FilterGroup
            label="Opportunity Type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <FilterGroup
            label="Region"
            options={REGION_OPTIONS}
            value={region}
            onChange={setRegion}
          />

          <button className="search-btn" onClick={runSearch} disabled={loading}>
            {loading ? (
              <><span className="btn-spinner" /> Searching 40+ sources...</>
            ) : (
              <><span>🔍</span> Search Opportunities</>
            )}
          </button>
        </div>

        {loading && <ScanningLoader sources={SCAN_SOURCES} />}

        {error && !loading && <div className="error-box">⚠ {error}</div>}

        {opportunities.length > 0 && (
          <>
            <div className="results-header">
              <div className="results-title">// RESULTS</div>
              <div className="results-count">
                {opportunities.length} found across 3 source categories ·{' '}
                {new Date().toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short',
                })}
              </div>
            </div>
            {opportunities.map((opp, i) => (
              <OpportunityCard key={i} opp={opp} index={i} onDraft={setDraftOpp} />
            ))}
          </>
        )}

        {!loading && !error && !searched && (
          <div className="empty">
            <div className="icon">🔭</div>
            <p>
              Choose your filters above and hit Search.<br />
              Results come from 40+ sources simultaneously.
            </p>
          </div>
        )}
      </div>

      {draftOpp && <DraftModal opp={draftOpp} onClose={() => setDraftOpp(null)} />}
    </>
  );
}
