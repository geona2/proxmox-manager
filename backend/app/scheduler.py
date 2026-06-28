import asyncio
import logging
from typing import Dict, Any, List
from app.config import settings
from app.storage import storage_manager
from app.proxmox import ProxmoxClient
from app.influx import influx_exporter

logger = logging.getLogger(__name__)

class MetricsScheduler:
    def __init__(self):
        self.task = None
        self.is_running = False

    def start(self):
        if not self.is_running:
            self.is_running = True
            self.task = asyncio.create_task(self._loop())
            logger.info("Metrics collection scheduler started.")

    async def stop(self):
        if self.is_running:
            self.is_running = False
            if self.task:
                self.task.cancel()
                try:
                    await self.task
                except asyncio.CancelledError:
                    pass
            influx_exporter.close()
            logger.info("Metrics collection scheduler stopped.")

    async def _loop(self):
        while self.is_running:
            try:
                # Load all registered servers
                servers = await storage_manager.get_all_servers()
                if servers:
                    # Poll all servers in parallel
                    await asyncio.gather(*(self._poll_server(server) for server in servers), return_exceptions=True)
            except Exception as e:
                logger.error(f"Error in metrics scheduler loop: {str(e)}", exc_info=True)
            
            await asyncio.sleep(settings.METRICS_INTERVAL)

    async def _poll_server(self, server: Dict[str, Any]):
        server_id = server["id"]
        server_name = server["name"]
        
        # All Proxmox API calls must have try-catch blocks
        try:
            if server["host"].lower() == "mock":
                from app.mock_handler import mock_handler
                resources = await mock_handler.get_mock_resources()
            else:
                client = ProxmoxClient(
                    host=server["host"],
                    port=server["port"],
                    username=server["username"],
                    token_name=server["token_name"],
                    token_value=server["token_value"],
                    verify_ssl=server.get("verify_ssl", False)
                )
                resources = await client.get_cluster_resources()
                
            if not resources:
                logger.warning(f"No resources returned for server {server_name} ({server_id})")
                return

            for res in resources:
                res_type = res.get("type")
                if res_type == "node":
                    influx_exporter.write_node_metrics(server_id, server_name, res)
                elif res_type in ["qemu", "lxc"]:
                    influx_exporter.write_guest_metrics(server_id, server_name, res)
                    
        except Exception as e:
            logger.error(f"Failed to poll metrics for server {server_name}: {str(e)}")

metrics_scheduler = MetricsScheduler()
