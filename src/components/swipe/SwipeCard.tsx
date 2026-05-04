import React from 'react';
import { useSpring, animated, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { Internship } from '../../types';
import styles from './SwipeCard.module.css';

interface SwipeCardProps {
  internship: Internship;
  onSwipeLeft: (internship: Internship) => void;
  onSwipeRight: (internship: Internship) => void;
  onViewDetails: (internship: Internship) => void;
  style?: React.CSSProperties;
}

const SWIPE_THRESHOLD = 120;
const FLY_OUT = 800;

function initials(name: string): string {
  return name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

export default function SwipeCard({
  internship,
  onSwipeLeft,
  onSwipeRight,
  onViewDetails,
  style: stackStyle,
}: SwipeCardProps) {
  const [{ x, y, rotate }, api] = useSpring(() => ({
    x: 0, y: 0, rotate: 0,
    config: { tension: 300, friction: 26 },
  }));

  const [{ applyOpacity, passOpacity }, overlayApi] = useSpring(() => ({
    applyOpacity: 0, passOpacity: 0,
    config: { tension: 300, friction: 26 },
  }));

  const bind = useDrag(
    ({ active, movement: [mx, my], velocity: [vx] }) => {
      if (active) {
        api.start({ x: mx, y: my * 0.3, rotate: mx * 0.055, immediate: true });
        overlayApi.start({
          applyOpacity: mx > 0 ? Math.min(mx / SWIPE_THRESHOLD, 1) : 0,
          passOpacity:  mx < 0 ? Math.min(-mx / SWIPE_THRESHOLD, 1) : 0,
          immediate: true,
        });
        return;
      }

      const triggered = Math.abs(mx) > SWIPE_THRESHOLD || vx > 0.5;
      if (triggered) {
        const dir = mx > 0 ? 1 : -1;
        api.start({ x: dir * FLY_OUT, y: my * 0.3, rotate: dir * 28, config: { tension: 200, friction: 30 } });
        overlayApi.start({ applyOpacity: dir > 0 ? 1 : 0, passOpacity: dir < 0 ? 1 : 0 });
        setTimeout(() => { dir > 0 ? onSwipeRight(internship) : onSwipeLeft(internship); }, 250);
      } else {
        api.start({ x: 0, y: 0, rotate: 0 });
        overlayApi.start({ applyOpacity: 0, passOpacity: 0 });
      }
    },
    { filterTaps: true }
  );

  const match = internship.matchScore || 0;
  const matchClass = match >= 85 ? styles.matchHigh : match >= 70 ? styles.matchMedium : styles.matchLow;

  const matchedSkills = internship.requirements.filter((r) => !internship.missingRequirements.includes(r)).slice(0, 4);
  const missingSkills = internship.missingRequirements.slice(0, 2);

  return (
    <animated.div
      {...bind()}
      className={styles.card}
      style={{ ...stackStyle, x, y, rotate: to([rotate], (r) => `${r}deg`) }}
      onClick={() => onViewDetails(internship)}
    >
      {/* Stamp overlays */}
      <animated.div className={`${styles.overlayLabel} ${styles.applyLabel}`} style={{ opacity: applyOpacity }}>
        APPLY
      </animated.div>
      <animated.div className={`${styles.overlayLabel} ${styles.passLabel}`} style={{ opacity: passOpacity }}>
        PASS
      </animated.div>

      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={`${styles.matchBadge} ${matchClass}`}>{match}% match</span>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.topRow}>
          <div className={styles.logo}>{initials(internship.company)}</div>
          <div className={styles.companyMeta}>
            <div className={styles.companyCategory}>{internship.field || 'Technology'}</div>
            <div className={styles.companyName}>{internship.company}</div>
          </div>
        </div>

        <h3 className={styles.jobTitle}>{internship.title}</h3>

        <div className={styles.chipRow}>
          <span className={styles.chip}>{internship.location}</span>
          {internship.isRemote && <span className={`${styles.chip} ${styles.chipSignal}`}>Remote</span>}
          {internship.duration && <span className={styles.chip}>{internship.duration}</span>}
          {internship.salary && <span className={styles.chip}>{internship.salary}</span>}
        </div>

        {internship.description && (
          <p className={styles.description}>{internship.description}</p>
        )}

        <div className={styles.skillsList}>
          {matchedSkills.map((r) => (
            <span key={r} className={styles.skillChip}>{r}</span>
          ))}
          {missingSkills.map((r) => (
            <span key={r} className={`${styles.skillChip}`} style={{ opacity: 0.5 }}>{r}</span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <span>{internship.applicantCount ?? '—'} applicants</span>
        <span>tap for details</span>
      </div>
    </animated.div>
  );
}
