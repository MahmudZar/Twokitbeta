// Records Content-Security-Policy violations for csp-smoke.html.
window.cspViolations = [];
document.addEventListener('securitypolicyviolation', (e) => {
    window.cspViolations.push(`${e.violatedDirective}: ${e.blockedURI || ''} ${e.sample || ''}`.trim());
});
