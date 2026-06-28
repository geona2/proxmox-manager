# Credentials Configuration Components (servers)

This module handles Proxmox API authorization credentials management.

## Cohesion & Coupling Analysis
- **High Cohesion**: Relies exclusively on editing server credentials (IP, Port, username, token ID, verify SSL checkbox).
- **Low Coupling**: Only renders visual card structures. When buttons are clicked, triggers are bubbled up to parent layout to display configuration dialogs.

## Features
- **ServersTab**: Displays credentials mapping.
- **RBAC Locking**: Automatically locks edit and delete buttons if the active user role is not "admin".
