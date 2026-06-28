# Dashboard Components (dashboard)

This module manages cluster-wide aggregate visualization and the listing of servers/guests.

## Cohesion & Coupling Analysis
- **High Cohesion**: It has the sole focus of visualizing real-time cluster workloads, cpu, memory, and storage resource utilization.
- **Low Coupling**: Child components communicate via functional dependency injection interfaces. Deletion safety constraints and power-toggling signals are bubbled up to the root dispatcher without tightly coupling node definitions to credential updates.

## Components
- **DashboardTab**: The main screen container summarizing global state parameters.
- **ServerAccordion**: Collapsible representation of a single Proxmox cluster datacenter.
- **GuestRow**: Displays guest details, badge filters, and exposes context-aware execution controls gated by user roles.
