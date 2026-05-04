import React from 'react';
import { Internship } from '../../types';
import SwipeCard from './SwipeCard';
import styles from './CardStack.module.css';

interface CardStackProps {
  internships: Internship[];
  onSwipeLeft: (internship: Internship) => void;
  onSwipeRight: (internship: Internship) => void;
  onViewDetails: (internship: Internship) => void;
  loading?: boolean;
}

const VISIBLE_COUNT = 3;

export default function CardStack({
  internships,
  onSwipeLeft,
  onSwipeRight,
  onViewDetails,
  loading = false,
}: CardStackProps) {
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    );
  }

  if (internships.length === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>&#x1F389;</span>
          <h3 className={styles.emptyTitle}>All caught up!</h3>
          <p className={styles.emptyText}>
            You have reviewed all available internships. Check back later for new matches.
          </p>
        </div>
      </div>
    );
  }

  // Show up to 3 cards; top card is last in DOM so it renders on top
  const visible = internships.slice(0, VISIBLE_COUNT);

  return (
    <div className={styles.wrapper}>
      {visible.map((internship, index) => {
        const isTop = index === 0;
        const scale = 1 - index * 0.04;
        const translateY = index * 10;

        return (
          <SwipeCard
            key={internship.id}
            internship={internship}
            onSwipeLeft={onSwipeLeft}
            onSwipeRight={onSwipeRight}
            onViewDetails={onViewDetails}
            style={{
              zIndex: VISIBLE_COUNT - index,
              transform: isTop ? undefined : `scale(${scale}) translateY(${translateY}px)`,
              pointerEvents: isTop ? 'auto' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
