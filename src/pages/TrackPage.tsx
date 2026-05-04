import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApplications } from '../hooks/useApplications';
import type { Application } from '../types';
import styles from './TrackPage.module.css';

type FilterKey = 'all' | 'action' | 'interviews' | 'review' | 'results';
type SortKey = 'recent' | 'company' | 'applied';

interface SectionConfig {
  key: string;
  label: string;
  statuses: Application['status'][];
  emptyText: string;
}

const SECTIONS: SectionConfig[] = [
  { key: 'action',     label: 'Action Required', statuses: ['Needs_Manual_Action'], emptyText: 'Nothing needs your attention.' },
  { key: 'interviews', label: 'Interviews',       statuses: ['Interview_Scheduled'], emptyText: 'No upcoming interviews.' },
  { key: 'review',     label: 'Under Review',     statuses: ['Under_Review', 'Submitted'], emptyText: 'No applications under review.' },
  { key: 'results',    label: 'Results',          statuses: ['Accepted', 'Rejected', 'Offer_Received', 'Withdrawn'], emptyText: 'No results yet.' },
];

const STATUS_STYLE: Record<string, string> = {
  Interview_Scheduled: styles.statusSignal,
  Auto_Applied:        styles.statusSignal,
  Needs_Manual_Action: styles.statusWarn,
  Accepted:            styles.statusOk,
  Offer_Received:      styles.statusOk,
  Rejected:            styles.statusWarn,
  Submitted:           styles.statusDim,
  Under_Review:        styles.statusDim,
  Withdrawn:           styles.statusDim,
};

const STATUS_LABEL: Record<string, string> = {
  Interview_Scheduled: 'Interview',
  Auto_Applied:        'Auto-Applied',
  Needs_Manual_Action: 'Action Needed',
  Accepted:            'Accepted',
  Offer_Received:      'Offer',
  Rejected:            'Declined',
  Submitted:           'Submitted',
  Under_Review:        'Under Review',
  Withdrawn:           'Withdrawn',
};

function initials(name: string) {
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

function fmtDate(s?: string) {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return s; }
}

function sortApps(apps: Application[], by: SortKey): Application[] {
  return [...apps].sort((a, b) => {
    if (by === 'company') return a.internship.company.localeCompare(b.internship.company);
    if (by === 'applied') return new Date(b.appliedDate || b.createdDate).getTime() - new Date(a.appliedDate || a.createdDate).getTime();
    return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
  });
}

export default function TrackPage() {
  const navigate = useNavigate();
  const { allApplications, loading } = useApplications();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    let apps = allApplications;
    if (search.trim()) {
      const q = search.toLowerCase();
      apps = apps.filter((a) => a.internship.company.toLowerCase().includes(q) || a.internship.title.toLowerCase().includes(q));
    }
    return apps;
  }, [allApplications, search]);

  const actionCount     = filtered.filter((a) => a.status === 'Needs_Manual_Action').length;
  const interviewCount  = filtered.filter((a) => a.status === 'Interview_Scheduled').length;
  const reviewCount     = filtered.filter((a) => a.status === 'Under_Review' || a.status === 'Submitted').length;
  const resultsCount    = filtered.filter((a) => ['Accepted','Rejected','Offer_Received','Withdrawn'].includes(a.status)).length;

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all',        label: 'All',       count: allApplications.length },
    { key: 'action',     label: 'Action',    count: actionCount },
    { key: 'interviews', label: 'Interview', count: interviewCount },
    { key: 'review',     label: 'Review',    count: reviewCount },
    { key: 'results',    label: 'Results',   count: resultsCount },
  ];

  const getSectionApps = useCallback((sec: SectionConfig) => {
    return sortApps(filtered.filter((a) => sec.statuses.includes(a.status)), sort);
  }, [filtered, sort]);

  const visibleSections = filter === 'all'
    ? SECTIONS
    : SECTIONS.filter((s) => s.key === filter || (filter === 'auto' && s.key === 'auto'));

  const getFlatFiltered = useMemo(() => {
    if (filter === 'all') return null;
    const sec = SECTIONS.find((s) => s.key === filter);
    return sec ? sortApps(filtered.filter((a) => sec.statuses.includes(a.status)), sort) : [];
  }, [filter, filtered, sort]);

  if (loading) return <div className={styles.page}><div className={styles.loading}>loading…</div></div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>My <em>Applications</em></h1>
        <div className={styles.pageSubtitle}>
          {allApplications.length} total · {actionCount} need you
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>⌕</span>
        <input
          className={styles.searchInput}
          placeholder="search companies, roles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div className={styles.filterChips}>
        {filterOptions.map((f) => (
          <button
            key={f.key}
            className={`${styles.chip} ${filter === f.key ? styles.chipActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className={styles.chipCount}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className={styles.sortRow}>
        <span className={styles.sortLabel}>sort by</span>
        <div className={styles.sortBtns}>
          {(['recent', 'company', 'applied'] as SortKey[]).map((s) => (
            <button
              key={s}
              className={`${styles.sortBtn} ${sort === s ? styles.sortBtnActive : ''}`}
              onClick={() => setSort(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={styles.sections}>
        {filter !== 'all' ? (
          getFlatFiltered && getFlatFiltered.length === 0 ? (
            <div className={styles.emptyState}>No applications match this filter.</div>
          ) : (
            getFlatFiltered?.map((app) => <AppCard key={app.id} app={app} onClick={() => navigate(`/application/${app.id}`)} />)
          )
        ) : (
          visibleSections.map((sec) => {
            const apps = getSectionApps(sec);
            const isCollapsed = collapsed[sec.key];
            return (
              <div key={sec.key} className={styles.sectionGroup}>
                <button
                  className={styles.sectionHeader}
                  onClick={() => setCollapsed((c) => ({ ...c, [sec.key]: !c[sec.key] }))}
                >
                  <span className={styles.sectionLeft}>
                    <span className={styles.sectionCaret}>{isCollapsed ? '▸' : '▾'}</span>
                    {sec.label}
                    <span className={styles.sectionCount}>[{apps.length}]</span>
                  </span>
                </button>
                {!isCollapsed && (
                  apps.length === 0
                    ? <div className={styles.emptySection}>— nothing here —</div>
                    : apps.map((app) => <AppCard key={app.id} app={app} onClick={() => navigate(`/application/${app.id}`)} />)
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function AppCard({ app, onClick }: { app: Application; onClick: () => void }) {
  const isActive = app.status === 'Interview_Scheduled' || app.status === 'Offer_Received' || app.status === 'Accepted';
  const statusClass = STATUS_STYLE[app.status] || styles.statusDim;
  const isAuto = app.status === 'Auto_Applied' || (app as any).autoApplied;
  const actionNeeded = (app as any).actionNeeded;

  return (
    <button className={styles.appCard} onClick={onClick}>
      <div className={styles.appCardInner}>
        <div className={`${styles.appAvatar} ${isActive ? styles.appAvatarActive : ''}`}>
          {initials(app.internship.company)}
        </div>
        <div className={styles.appContent}>
          <div className={styles.appHeaderRow}>
            <span className={styles.appCompany}>{app.internship.company}</span>
            {isAuto && <span className={styles.appAuto}>⚡ Auto</span>}
          </div>
          <div className={styles.appRole}>{app.internship.title}</div>
          <div className={styles.appMeta}>
            <span className={`${styles.appStatus} ${statusClass}`}>{STATUS_LABEL[app.status] || app.status}</span>
            <span className={styles.appDate}>· {fmtDate(app.appliedDate || app.createdDate)}</span>
          </div>
          {actionNeeded && <div className={styles.appAction}>⚠ {actionNeeded}</div>}
        </div>
        <span className={styles.appChevron}>›</span>
      </div>
    </button>
  );
}
