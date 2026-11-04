# Security reports

Please report security vulnerabilities privately through
[GitHub's vulnerability reporting form](https://github.com/Joydivisor/Folio/security/advisories/new).
Include the affected version, reproduction steps, impact and a minimal example.
Do not post working credentials, private documents or exploit details in a public issue.

Security fixes target the latest stable release. Ordinary bugs and feature requests
belong in [Issues](https://github.com/Joydivisor/Folio/issues).

Folio serves its UI on loopback, keeps model credentials out of workspace backups,
and validates structured model output before rendering it. Model responses must
not introduce arbitrary script execution or bypass local-file and IPC boundaries.
