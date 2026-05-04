import { NavLink } from 'react-router-dom';
import styles from './Header.module.css';

const NAV_LINKS = [
  { to: '/', label: 'Discover', end: true },
  { to: '/track', label: 'Track' },
  { to: '/ai-chat', label: 'Mate' },
  { to: '/profile', label: 'Profile' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/" className={styles.logo}>
          <div className={styles.logoMark}>
            <div className={styles.logoTriangle} />
          </div>
          <span className={styles.logoText}>FURSA</span>
        </NavLink>

        <nav className={styles.desktopNav}>
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.active}` : styles.navLink
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
