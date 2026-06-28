# Modal Components (modals)

This directory contains standalone modal dialog components for specific administrative workflows.

## Cohesion & Coupling Analysis
- **High Cohesion**: Each modal component encapsulates a single form setup: server config, guest setup, deletion double-check, image downloader trigger, or template configuration.
- **Low Coupling**: Modals do not fetch API data themselves. Instead, they accept pre-populated options lists (like `nodes`, `storages`, `imagesList`) and bubble user interactions back up via declarative callback event triggers (`onSubmit`, `onClose`, `onServerChange`).

## Sub-Features
- **CreateGuestModal**: Configures CPU, RAM, disk, storage, templates, and optional static/DHCP Cloud-Init profiles.
- **CreateTemplateModal**: Configures template building from Ubuntu/RHEL ISO mappings.
- **ServerCredentialModal**: Handles Server CRUD fields, verifying SSL ignore flags.
- **DeleteGuestConfirmModal**: Enforces safety verification before destructive VM deletions.
- **DistributeImageModal**: Directs image distribution targeting individual storage pools.
