type ProfileCompletionFields = {
  nombre?: string | null;
  carrera?: string | null;
};

const PLACEHOLDER_CAREERS = new Set(['', 'Estudiante', 'General', 'Carrera']);

export function isProfileComplete(profile: ProfileCompletionFields | null | undefined) {
  const name = profile?.nombre?.trim() ?? '';
  const career = profile?.carrera?.trim() ?? '';

  return name.length > 0 && !PLACEHOLDER_CAREERS.has(career);
}
