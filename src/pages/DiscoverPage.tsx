import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Internship } from '../types';
import { useInternships } from '../hooks/useInternships';
import { useApplications } from '../hooks/useApplications';
import { useSwipe } from '../hooks/useSwipe';
import { useUserContext } from '../context/UserContext';
import CardStack from '../components/swipe/CardStack';
import SwipeButtons from '../components/swipe/SwipeButtons';
import InternshipDetail from '../components/internships/InternshipDetail';
import styles from './DiscoverPage.module.css';

export default function DiscoverPage() {
  const { internships, loading } = useInternships({ sortBy: 'matchScore', sortOrder: 'desc' });
  const { statusCounts } = useApplications();
  const { profile } = useUserContext();

  const {
    handleSwipeRight,
    handleSwipeLeft,
    undoLastSwipe,
    resetAllSwipes,
    canUndo,
    hasSwipes,
  } = useSwipe(internships);

  const [detailInternship, setDetailInternship] = useState<Internship | null>(null);

  const remainingCards = useMemo(() => {
    const swipedIds = new Set(profile.swipeHistory.map((s) => s.internshipId));
    return internships.filter((i) => !swipedIds.has(i.id));
  }, [internships, profile.swipeHistory]);

  const savedCount = (statusCounts['Saved'] || 0) + (statusCounts['Needs_Manual_Action'] || 0);
  const appliedCount =
    (statusCounts['Auto_Applied'] || 0) +
    (statusCounts['Submitted'] || 0) +
    (statusCounts['Under_Review'] || 0);
  const interviewCount = statusCounts['Interview_Scheduled'] || 0;

  const currentCard = remainingCards.length > 0 ? remainingCards[0] : null;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (detailInternship) return;

      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        undoLastSwipe();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetAllSwipes();
        return;
      }

      if (!currentCard) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipeLeft(currentCard);
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipeRight(currentCard);
      }

      if (e.key === ' ') {
        e.preventDefault();
        setDetailInternship(currentCard);
      }
    },
    [
      currentCard,
      detailInternship,
      handleSwipeLeft,
      handleSwipeRight,
      resetAllSwipes,
      undoLastSwipe,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const onSwipeRight = useCallback((i: Internship) => handleSwipeRight(i), [handleSwipeRight]);
  const onSwipeLeft = useCallback((i: Internship) => handleSwipeLeft(i), [handleSwipeLeft]);
  const onViewDetails = useCallback((i: Internship) => setDetailInternship(i), []);
  const onCloseDetail = useCallback(() => setDetailInternship(null), []);
  const onDetailApply = useCallback(
    (i: Internship) => {
      setDetailInternship(null);
      handleSwipeRight(i);
    },
    [handleSwipeRight]
  );
  const onDetailPass = useCallback(
    (i: Internship) => {
      setDetailInternship(null);
      handleSwipeLeft(i);
    },
    [handleSwipeLeft]
  );

  return (
    <div className={styles.page}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>
            <span>Saved</span>
            <span className={styles.statHint}>UP</span>
          </div>
          <div className={styles.statValue}>{savedCount}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>
            <span>Applied</span>
            <span className={styles.statHint}>GO</span>
          </div>
          <div className={`${styles.statValue} ${styles.statValueAccent}`}>{appliedCount}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>
            <span>Interviews</span>
            <span className={styles.statHint}>LIVE</span>
          </div>
          <div className={styles.statValue}>{interviewCount}</div>
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.controlButtons}>
          <button className={styles.undoBtn} onClick={undoLastSwipe} disabled={!canUndo}>
            Undo
          </button>
          <button className={styles.resetBtn} onClick={resetAllSwipes} disabled={!hasSwipes}>
            Reset Deck
          </button>
        </div>
      </div>

      <div className={styles.cardStage}>
        <CardStack
          internships={remainingCards}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
          onViewDetails={onViewDetails}
          loading={loading}
        />
      </div>

      <SwipeButtons
        onPass={() => currentCard && handleSwipeLeft(currentCard)}
        onInfo={() => currentCard && setDetailInternship(currentCard)}
        onApply={() => currentCard && handleSwipeRight(currentCard)}
        disabled={!currentCard || loading}
      />

      {detailInternship && (
        <InternshipDetail
          internship={detailInternship}
          onClose={onCloseDetail}
          onApply={onDetailApply}
          onPass={onDetailPass}
        />
      )}
    </div>
  );
}
