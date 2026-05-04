import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../hooks/useProfile';
import { useDocuments } from '../hooks/useDocuments';
import type { Document } from '../types';
import styles from './ProfilePage.module.css';

interface ProfilePageProps {
  onLogout?: () => void;
}

function initials(name: string) {
  return (name || '?').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

function ScoreDial({ score }: { score: number }) {
  const r = 30, c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="4" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--signal)" strokeWidth="4"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
    </svg>
  );
}

export default function ProfilePage({ onLogout }: ProfilePageProps) {
  const navigate = useNavigate();
  const { profile, toggleSetting, applicationStats } = useProfile();
  const { documents, uploadDocument, deleteDocument } = useDocuments();
  const [analyzing, setAnalyzing] = useState(false);

  const strengthScore = 78;
  const strongAreas = [
    'Strong technical skills in AI/ML and Computer Vision',
    'Research experience with published project work',
    'Relevant university coursework and GPA',
  ];
  const suggestions = [
    'Add cloud computing certifications (AWS/Azure)',
    'Gain more customer-facing or leadership experience',
    'Include more quantitative achievements in CV',
  ];

  const settingsItems: { label: string; key: 'aiSuggestionsEnabled' | 'darkMode' }[] = [
    { label: 'Dark Mode', key: 'darkMode' },
    { label: 'AI Suggestions', key: 'aiSuggestionsEnabled' },
  ];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>{initials(profile.name)}</div>
        <div className={styles.profileInfo}>
          <h2 className={styles.profileName}>{profile.name}</h2>
          <div className={styles.profileEmail}>{profile.email}</div>
          <div className={styles.profileUni}>
            {profile.university} · {profile.graduationYear || 'Student'}
          </div>
        </div>
        <button className={styles.editBtn}>edit</button>
      </div>

      {/* Stats */}
      <div className={styles.sectionTitle}>
        <span className={styles.sectionLabel}>— activity</span>
      </div>
      <div className={styles.statsGrid}>
        <div className={`${styles.statTile} ${styles.statTileAccent}`}>
          <div className={styles.statTileLabel}>Applied</div>
          <div className={styles.statTileValue}>{applicationStats.total}</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>Interviews</div>
          <div className={styles.statTileValue}>{applicationStats.interviews}</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileLabel}>Offers</div>
          <div className={styles.statTileValue}>{applicationStats.offers}</div>
        </div>
      </div>

      {/* Documents */}
      <div className={styles.sectionTitle}>
        <span className={styles.sectionLabel}>— documents <span className={styles.sectionCount}>[{documents.length}]</span></span>
      </div>
      <div className={styles.docSection}>
        {documents.map((doc: Document) => (
          <div key={doc.id} className={styles.docItem}>
            <div className={styles.docIcon}>PDF</div>
            <div className={styles.docName}>
              {doc.name} {doc.id === profile.masterCVId && <span className={styles.docCurrent}>· CURRENT</span>}
              <div className={styles.docMeta}>{doc.type} · {doc.createdDate ? new Date(doc.createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</div>
            </div>
            <button className={styles.docMenu} onClick={() => deleteDocument(doc.id)}>⋯</button>
          </div>
        ))}
        <button
          className={styles.uploadBtn}
          onClick={() => { const f = document.createElement('input'); f.type = 'file'; f.onchange = (e) => { const file = (e.target as HTMLInputElement).files?.[0]; if (file) uploadDocument(file, file.name, 'Other'); }; f.click(); }}
        >
          + Upload Document
        </button>
      </div>

      {/* AI Analysis */}
      <div className={styles.sectionTitle}>
        <span className={styles.sectionLabel}>— AI analysis</span>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', fontFamily: 'var(--font-body)' }}>mate v2</span>
      </div>
      <div className={styles.aiSection}>
        <div className={styles.aiCard}>
          <div className={styles.aiCardHeader}>
            <ScoreDial score={strengthScore} />
            <div>
              <div className={styles.aiScoreLabel}>Profile Strength</div>
              <div className={styles.aiScoreValue}>{strengthScore}<span style={{ fontSize: 14, color: 'var(--ink-faint)' }}>/100</span></div>
              <div className={styles.aiScoreSub}>Top 22% of CS juniors</div>
            </div>
          </div>
          <div className={styles.aiSep}>───── strengths ─────</div>
          {strongAreas.map((s, i) => (
            <div key={i} className={styles.aiItem}>
              <span className={styles.aiItemOk}>✓</span>
              <span>{s}</span>
            </div>
          ))}
          <div className={styles.aiSep}>───── improve ─────</div>
          {suggestions.map((s, i) => (
            <div key={i} className={styles.aiItem}>
              <span className={styles.aiItemWarn}>⚠</span>
              <span>{s}</span>
            </div>
          ))}
          <button
            className={styles.analyzeBtn}
            disabled={analyzing}
            onClick={() => { setAnalyzing(true); setTimeout(() => { setAnalyzing(false); navigate('/ai-chat'); }, 1200); }}
          >
            {analyzing ? <><span className="spinner" /> ANALYZING…</> : 'Get Detailed Analysis →'}
          </button>
        </div>
      </div>

      {/* Connected Accounts */}
      <div className={styles.sectionTitle}>
        <span className={styles.sectionLabel}>— connected accounts</span>
      </div>
      <div className={styles.accountSection}>
        <div className={styles.accountRow}>
          <div className={styles.accountIcon}>Li</div>
          <div className={styles.accountInfo}>
            <div className={styles.accountName}>LinkedIn</div>
            <div className={styles.accountHandle}>@{profile.name?.toLowerCase().replace(/\s/g, '')}</div>
          </div>
          <span className={styles.connectedBadge}><span className={styles.connectedBadgeDot} />connected</span>
        </div>
        <div className={styles.accountRow}>
          <div className={styles.accountIcon}>Gh</div>
          <div className={styles.accountInfo}>
            <div className={styles.accountName}>GitHub</div>
            <div className={styles.accountHandle}>not connected</div>
          </div>
          <button className={styles.connectBtn}>Connect</button>
        </div>
      </div>

      {/* Settings */}
      <div className={styles.sectionTitle}>
        <span className={styles.sectionLabel}>— settings</span>
      </div>
      <div className={styles.settingsSection}>
        {settingsItems.map((item) => (
          <div key={item.key} className={styles.settingRow}>
            <span className={styles.settingLabel}>{item.label}</span>
            <div
              className={`${styles.toggle} ${profile[item.key] ? styles.toggleOn : ''}`}
              onClick={() => toggleSetting(item.key)}
              role="switch"
              aria-checked={profile[item.key]}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={styles.profileFooter}>
        <button className={styles.aboutLink} onClick={() => navigate('/about')}>
          ABOUT CAREERMATE →
        </button>
        <button className={styles.logoutBtn} onClick={onLogout}>⏻ Logout</button>
      </div>
      <div className={styles.version}>careermate v1.0 · se411 · 2026</div>
    </div>
  );
}
