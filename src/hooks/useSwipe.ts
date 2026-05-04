import { useState, useCallback, useMemo } from 'react';
import { Internship, Application, SwipeHistory } from '../types';
import { useAppContext } from '../context/AppContext';
import { useUserContext } from '../context/UserContext';
import { useAgentSystem } from '../context/AgentContext';
import { internshipToCard } from '../agents/agentBridge';

interface SwipeAction {
  internshipId: string;
  direction: 'left' | 'right';
  timestamp: string;
}

export function useSwipe(internships: Internship[]) {
  const { addApplication, showToast } = useAppContext();
  const { profile, updateProfile } = useUserContext();
  const { agentState, generateDeliverables } = useAgentSystem();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeStack, setSwipeStack] = useState<SwipeAction[]>([]);

  // Filter out already-swiped internships
  const swipedIds = useMemo(
    () => new Set(profile.swipeHistory.map((s) => s.internshipId)),
    [profile.swipeHistory]
  );

  const availableCards = useMemo(
    () => internships.filter((i) => !swipedIds.has(i.id)),
    [internships, swipedIds]
  );

  const currentCard = availableCards[currentIndex] ?? null;
  const remainingCards = availableCards.length - currentIndex;

  const recordSwipe = useCallback(
    (internshipId: string, direction: 'left' | 'right', matchScore: number) => {
      const entry: SwipeHistory = {
        internshipId,
        direction,
        timestamp: new Date().toISOString(),
        matchScore,
      };
      updateProfile({
        swipeHistory: [...profile.swipeHistory, entry],
      });
    },
    [profile.swipeHistory, updateProfile]
  );

  const handleSwipeRight = useCallback(
    (internship: Internship) => {
      const now = new Date().toISOString();

      // Advance the deck immediately so the swipe feels snappy.
      // The agent's tailored CV + cover letter generation runs async in the background below.
      recordSwipe(internship.id, 'right', internship.matchScore);
      setSwipeStack((prev) => [
        ...prev,
        { internshipId: internship.id, direction: 'right', timestamp: now },
      ]);
      setCurrentIndex((prev) => prev + 1);

      // Look up the matching agent card. If the swipe is on a legacy/mock internship that
      // isn't in agent state, fall back to building a synthetic card so the agent can still
      // generate a tailored CV + cover letter from the internship's title/requirements.
      const existingCard = agentState.cards.find((c) => c.opportunity.id === internship.id);
      const card = existingCard ?? internshipToCard(internship);
      if (!existingCard) {
        console.log('[useSwipe] No matching agent card — using synthetic card for', internship.company);
      }

      showToast(`Generating tailored CV for ${internship.company}…`, 'info');

      void (async () => {
        const enriched = await generateDeliverables(card);
        console.log('[useSwipe] Deliverables ready for', internship.company, {
          hasTailoredCV: !!enriched.tailoredCV,
          hasCoverLetter: !!enriched.coverLetter,
        });

        const cvVersion = enriched.tailoredCV
          ? `Auto-Tailored CV — ${internship.company}`
          : 'default';

        const newApplication: Omit<Application, 'id'> = {
          internshipId: internship.id,
          internship,
          status: 'Needs_Manual_Action',
          savedDate: now,
          appliedDate: undefined,
          deadlineDate: internship.deadline,
          cvVersion,
          tailoredCV: enriched.tailoredCV,
          coverLetter: enriched.coverLetter,
          additionalDocs: [],
          notes: enriched.interviewTips ? `Interview Tips:\n${enriched.interviewTips}` : '',
          aiSuggestions: enriched.matchReason ? [enriched.matchReason] : [],
          confidenceScore: internship.matchScore,
          createdDate: now,
          lastUpdated: now,
          autoApplied: false,
        };

        addApplication(newApplication);

        const docsBuilt = !!(enriched.tailoredCV && enriched.coverLetter);
        if (docsBuilt) {
          showToast(`Tailored CV + cover letter ready for ${internship.company}!`, 'success');
        } else {
          showToast(`Saved ${internship.company} — complete your application`, 'info');
        }
      })();
    },
    [addApplication, recordSwipe, showToast, agentState.cards, generateDeliverables]
  );

  const handleSwipeLeft = useCallback(
    (internship: Internship) => {
      recordSwipe(internship.id, 'left', internship.matchScore);
      setSwipeStack((prev) => [
        ...prev,
        {
          internshipId: internship.id,
          direction: 'left',
          timestamp: new Date().toISOString(),
        },
      ]);
      setCurrentIndex((prev) => prev + 1);
    },
    [recordSwipe]
  );

  const undoLastSwipe = useCallback(() => {
    if (swipeStack.length === 0) return;

    const lastSwipe = swipeStack[swipeStack.length - 1];

    // Remove from swipe history in profile
    updateProfile({
      swipeHistory: profile.swipeHistory.filter(
        (s) => s.internshipId !== lastSwipe.internshipId
      ),
    });

    setSwipeStack((prev) => prev.slice(0, -1));
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    showToast('Last swipe undone', 'info');
  }, [swipeStack, profile.swipeHistory, updateProfile, showToast]);

  const resetAllSwipes = useCallback(() => {
    if (profile.swipeHistory.length === 0) return;

    updateProfile({ swipeHistory: [] });
    setSwipeStack([]);
    setCurrentIndex(0);
    showToast('All swipes reset for demo mode', 'info');
  }, [profile.swipeHistory.length, showToast, updateProfile]);

  return {
    currentIndex,
    currentCard,
    remainingCards,
    handleSwipeRight,
    handleSwipeLeft,
    undoLastSwipe,
    resetAllSwipes,
    canUndo: swipeStack.length > 0,
    hasSwipes: profile.swipeHistory.length > 0,
    totalCards: availableCards.length,
  };
}
