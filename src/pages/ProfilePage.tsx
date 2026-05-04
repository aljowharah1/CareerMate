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

export default function ProfilePage({ onLogout }: ProfilePageProps) {
  const navigate = useNavigate();
  const { profile, toggleSetting, applicationStats } = useProfile();
  const { documents, uploadDocument, deleteDocument } = useDocuments();

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

      {/* Skills — derived from the uploaded CV */}
      {profile.skills && profile.skills.length > 0 && (
        <>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionLabel}>— skills <span className={styles.sectionCount}>[{profile.skills.length}]</span></span>
          </div>
          <div className={styles.docSection}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--ink-dim)',
                    background: 'var(--bg-1)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

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
          ABOUT FURSA →
        </button>
        <button className={styles.logoutBtn} onClick={onLogout}>⏻ Logout</button>
      </div>
      <div className={styles.version}>fursa v1.0 · cs496 · 2026</div>
    </div>
  );
}
