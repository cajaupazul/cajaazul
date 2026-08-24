type ProfileCompletionFields = {
  nombre?: string | null;
  carrera?: string | null;
  onboarding_completed_at?: string | null;
};

const PLACEHOLDER_CAREERS = new Set(['', 'Estudiante', 'General', 'Carrera']);

export function isProfileComplete(profile: ProfileCompletionFields | null | undefined) {
  if (profile && Object.prototype.hasOwnProperty.call(profile, 'onboarding_completed_at')) {
    return Boolean(profile.onboarding_completed_at);
  }

  const name = profile?.nombre?.trim() ?? '';
  const career = profile?.carrera?.trim() ?? '';

  return name.length > 0 && !PLACEHOLDER_CAREERS.has(career);
}
