import { useUserContext } from '../context/UserContext';

/**
 * Convenience hook that wraps UserContext for profile operations.
 */
export function useProfile() {
  const { profile, updateProfile, updatePreferences, toggleSetting } = useUserContext();

  return {
    profile,
    updateProfile,
    updatePreferences,
    toggleSetting,
    // Derived convenience fields
    isProfileComplete:
      profile.name !== '' &&
      profile.email !== '' &&
      profile.university !== '' &&
      profile.major !== '' &&
      profile.skills.length > 0,
    hasExperience: profile.experience.length > 0,
    hasProjects: profile.projects.length > 0,
    applicationStats: {
      total: profile.totalApplications,
      interviews: profile.interviewsScheduled,
      offers: profile.offersReceived,
    },
  };
}
