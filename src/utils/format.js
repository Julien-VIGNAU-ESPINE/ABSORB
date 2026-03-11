/**
 * Formats a number as currency (Euro)
 */
function fmtCurrency(n) {
    return Number(n).toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Standard number formatting with 2 decimal places
 */
function fmtNum(n) {
    return Number(n).toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Formats a date to French format
 */
function fmtDate(date) {
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
