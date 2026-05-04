import styles from './ProfileStats.module.css';

interface ProfileStatsProps {
  stats: {
    total: number;
    interviews: number;
    offers: number;
  };
}

export default function ProfileStats({ stats }: ProfileStatsProps) {
  const items = [
    { label: 'Total Applications', value: stats.total },
    { label: 'Interviews', value: stats.interviews },
    { label: 'Offers', value: stats.offers },
  ];

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div key={item.label} className={styles.card}>
          <div className={styles.number}>{item.value}</div>
          <div className={styles.label}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
