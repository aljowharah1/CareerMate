// src/context/AgentContext.tsx
// After agents finish, this automatically:
// 1. Pushes internships into AppContext (so DiscoverPage shows them)
// 2. Updates UserContext profile (so ProfilePage shows real data)
// 3. On swipe right: adds application into AppContext (so TrackPage shows it)

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { TeamLeaderAgent } from '../agents/TeamLeaderAgent';
import { cardToInternship, cardToApplication, studentToUserProfile } from '../agents/agentBridge';
import type { AgentSystemState, OpportunityCard } from '../agents/types';
import { useAppContext } from './AppContext';
import { useUserContext } from './UserContext';

const initialState: AgentSystemState = {
  profile: null,
  cards: [],
  swipePreferences: {
    likedFields: [],
    skippedFields: [],
    likedCompanies: [],
    skippedCompanies: [],
  },
  agentLog: [],
  isReady: false,
  currentPhase: 'Waiting for CV upload',
  error: null,
};

type Action =
  | { type: 'SET_PHASE'; phase: string }
  | { type: 'SET_READY'; state: AgentSystemState }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'UPDATE_CARD'; card: OpportunityCard }
  | { type: 'APPEND_CARDS'; cards: OpportunityCard[] }
  | { type: 'UPDATE_PREFERENCES'; preferences: AgentSystemState['swipePreferences'] };

function reducer(state: AgentSystemState, action: Action): AgentSystemState {
  switch (action.type) {
    case 'SET_PHASE': return { ...state, currentPhase: action.phase };
    case 'SET_READY': return { ...action.state };
    case 'SET_ERROR': return { ...state, error: action.error, currentPhase: 'Error' };
    case 'UPDATE_CARD':
      return { ...state, cards: state.cards.map((c) => c.opportunity.id === action.card.opportunity.id ? action.card : c) };
    case 'APPEND_CARDS': return { ...state, cards: [...state.cards, ...action.cards] };
    case 'UPDATE_PREFERENCES': return { ...state, swipePreferences: action.preferences };
    default: return state;
  }
}

interface AgentContextValue {
  agentState: AgentSystemState;
  uploadCV: (cvFile: File, coverLetterFile?: File) => Promise<void>;
  onSwipeRight: (card: OpportunityCard) => Promise<void>;
  onSwipeLeft: (card: OpportunityCard) => Promise<void>;
  // Runs the DevPlanning agent to produce a tailored CV + cover letter + interview tips
  // for a card and updates agent state. Does NOT create an Application — the caller does that.
  generateDeliverables: (card: OpportunityCard) => Promise<OpportunityCard>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agentState, dispatch] = useReducer(reducer, initialState);
  const { addInternship, addApplication, showToast } = useAppContext();
  const { updateProfile } = useUserContext();
  const teamLeader = useRef(new TeamLeaderAgent());

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const uploadCV = useCallback(async (cvFile: File, coverLetterFile?: File) => {
    dispatch({ type: 'SET_PHASE', phase: 'Starting up...' });
    try {
      const cvBase64 = await fileToBase64(cvFile);
      const clBase64 = coverLetterFile ? await fileToBase64(coverLetterFile) : undefined;

      const result = await teamLeader.current.initialize(
        cvBase64,
        clBase64,
        (phase) => dispatch({ type: 'SET_PHASE', phase })
      );

      // Push profile into UserContext → ProfilePage shows real data
      if (result.profile) {
        updateProfile(studentToUserProfile(result.profile));
      }

      // Push internships into AppContext → DiscoverPage shows agent cards
      console.log("Agent cards found:", result.cards.length);
console.log("Cards:", result.cards);

for (const card of result.cards) {
  await addInternship(cardToInternship(card) as any);
}
      
      for (const card of result.cards) {
        await addInternship(cardToInternship(card) as any);
      }

      dispatch({ type: 'SET_READY', state: result });
      showToast(`Found ${result.cards.length} matched opportunities!`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent error';
      dispatch({ type: 'SET_ERROR', error: message });
      showToast(message, 'error');
    }
  }, [addInternship, updateProfile, showToast]);

  const generateDeliverables = useCallback(async (card: OpportunityCard): Promise<OpportunityCard> => {
    if (!agentState.profile) return card;
    try {
      const { updatedCard, updatedPreferences } = await teamLeader.current.handleSwipeRight(
        card, agentState.profile, agentState.swipePreferences
      );
      dispatch({ type: 'UPDATE_CARD', card: updatedCard });
      dispatch({ type: 'UPDATE_PREFERENCES', preferences: updatedPreferences });
      return updatedCard;
    } catch (err) {
      console.warn('generateDeliverables failed:', err);
      return card;
    }
  }, [agentState.profile, agentState.swipePreferences]);

  const onSwipeRight = useCallback(async (card: OpportunityCard) => {
    if (!agentState.profile) return;
    try {
      const { updatedCard, updatedPreferences } = await teamLeader.current.handleSwipeRight(
        card, agentState.profile, agentState.swipePreferences
      );
      await addApplication(cardToApplication(updatedCard));
      dispatch({ type: 'UPDATE_CARD', card: updatedCard });
      dispatch({ type: 'UPDATE_PREFERENCES', preferences: updatedPreferences });
      if (updatedCard.tailoredCV && updatedCard.coverLetter) {
        showToast(`Tailored CV + cover letter generated for ${card.opportunity.company}!`, 'success');
      } else if (updatedCard.coverLetter) {
        showToast(`Cover letter generated for ${card.opportunity.company}!`, 'success');
      } else {
        showToast(`Saved ${card.opportunity.company}`, 'info');
      }
    } catch {
      await addApplication(cardToApplication(card));
      showToast(`Saved ${card.opportunity.company}`, 'info');
    }
  }, [agentState.profile, agentState.swipePreferences, addApplication, showToast]);

  const onSwipeLeft = useCallback(async (card: OpportunityCard) => {
    if (!agentState.profile) return;
    const remaining = agentState.cards.filter(
      (c) => c.status === 'unseen' && c.opportunity.id !== card.opportunity.id
    );
    const { updatedPreferences, newCards } = await teamLeader.current.handleSwipeLeft(
      card, agentState.swipePreferences, remaining, agentState.profile
    );
    dispatch({ type: 'UPDATE_CARD', card: { ...card, status: 'skipped' } });
    dispatch({ type: 'UPDATE_PREFERENCES', preferences: updatedPreferences });
    if (newCards && newCards.length > 0) {
      dispatch({ type: 'APPEND_CARDS', cards: newCards });
      for (const c of newCards) {
        await addInternship(cardToInternship(c) as any);
      }
    }
  }, [agentState.profile, agentState.cards, agentState.swipePreferences, addInternship]);

  return (
    <AgentContext.Provider value={{ agentState, uploadCV, onSwipeRight, onSwipeLeft, generateDeliverables }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentSystem() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgentSystem must be used inside AgentProvider');
  return ctx;
}