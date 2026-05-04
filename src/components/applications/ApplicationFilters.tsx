import styles from './ApplicationFilters.module.css';

export type FilterCategory =
  | 'All'
  | 'Action_Needed'
  | 'Interviews'
  | 'Under_Review'
  | 'Results';

export type SortOption = 'deadline' | 'applied' | 'match' | 'company';

interface ApplicationFiltersProps {
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusCounts: Record<string, number>;
}

const FILTER_TABS: { key: FilterCategory; label: string }[] = [
  { key: 'All', label: 'All' },
  { key: 'Action_Needed', label: 'Action Needed' },
  { key: 'Interviews', label: 'Interviews' },
  { key: 'Under_Review', label: 'Under Review' },
  { key: 'Results', label: 'Results' },
];

function getFilterCount(
  key: FilterCategory,
  statusCounts: Record<string, number>,
  total: number,
): number {
  switch (key) {
    case 'All':
      return total;
    case 'Action_Needed':
      return (statusCounts['Needs_Manual_Action'] || 0);
    case 'Interviews':
      return (statusCounts['Interview_Scheduled'] || 0);
    case 'Under_Review':
      return (statusCounts['Under_Review'] || 0) + (statusCounts['Submitted'] || 0);
    case 'Results':
      return (
        (statusCounts['Accepted'] || 0) +
        (statusCounts['Rejected'] || 0) +
        (statusCounts['Offer_Received'] || 0) +
        (statusCounts['Withdrawn'] || 0)
      );
    default:
      return 0;
  }
}

export default function ApplicationFilters({
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  statusCounts,
}: ApplicationFiltersProps) {
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`${styles.tab} ${activeFilter === key ? styles.tabActive : ''}`}
            onClick={() => onFilterChange(key)}
          >
            {label}
            <span className={styles.count}>
              {getFilterCount(key, statusCounts, total)}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.controls}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>&#128269;</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by company or position..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
        >
          <option value="deadline">Sort by Deadline</option>
          <option value="applied">Sort by Date Applied</option>
          <option value="match">Sort by Match Score</option>
          <option value="company">Sort by Company</option>
        </select>
      </div>
    </div>
  );
}
