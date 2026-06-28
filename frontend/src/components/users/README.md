# User Control Components (users)

This module handles RBAC account management settings.

## Cohesion & Coupling Analysis
- **High Cohesion**: Exclusive focus on listing existing users, adding new users, hashing passwords on backend, and deleting accounts.
- **Low Coupling**: Independent of Proxmox VMs, host directories, or image distribution channels. Relies purely on the authentication session token passed by context props.

## Features
- **UsersTab**: Form mapping and table view.
- **Admin Isolation**: Exclusively visible and mountable when the active login payload specifies a role of "admin".
