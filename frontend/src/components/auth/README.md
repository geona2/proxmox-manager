# Authentication Component (auth)

This module handles authentication screens and secure session storage logic.

## Cohesion & Coupling Analysis
- **High Cohesion**: It has the single responsibility of managing login states, credential checks, and token initialization.
- **Low Coupling**: It receives the API location through props (`backendUrl`) and forwards success states via callback handler (`onLoginSuccess`). It is completely independent of VM operations or server credentials rendering.

## Sub-Features
- **Login Overlay**: Renders dynamic user credentials prompt with error interception and premium dark styling.
- **Role Assignment Cache**: Stores successful token parameters locally in order to persistent sessions across browser page reloads.
