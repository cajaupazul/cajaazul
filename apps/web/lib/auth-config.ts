/**
 * Centralized Authentication Configuration
 * Strictly enforces @alum.up.edu.pe
 */

export const AUTH_CONFIG = {
    allowedDomain: '@alum.up.edu.pe',

    messages: {
        domainError: 'Acceso restringido: Solo se permiten correos institucionales @alum.up.edu.pe',
        genericError: 'Ocurrió un error inesperado al intentar procesar tu solicitud.',
        logoutSuccess: 'Has cerrado sesión exitosamente.',
        accountDeleted: 'Tu cuenta ha sido eliminada permanentemente.',
    },

    minPasswordLength: 6,

    redirects: {
        afterLogin: '/dashboard',
        afterLogout: '/auth/login',
        unauthorized: '/auth/login',
    }
};

/**
 * Validates if an email belongs to the institutional domain.
 */
export function validateInstitutionalEmail(email: string): boolean {
    const trimmedEmail = email.trim().toLowerCase();
    return trimmedEmail.endsWith(AUTH_CONFIG.allowedDomain);
}
