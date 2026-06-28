# Storage & Template Components (images)

This module handles ISO upload operations, image catalog grids, and template build triggers.

## Cohesion & Coupling Analysis
- **High Cohesion**: Focused solely on storage cataloging, file chunk uploading, and Proxmox node disk distribution.
- **Low Coupling**: Leverages props to receive file listings and sends request triggers upstream to root containers.

## Features
- **ImagesTab**: Renders file pickers, catalog grids, and template builder gateways.
- **LXC/VM Toggle**: Restricts template list views according to guest type selections.
- **Template Generation**: Triggers custom VM template build sequences.
