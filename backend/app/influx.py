import logging
from typing import List, Dict, Any
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from app.config import settings

logger = logging.getLogger(__name__)

class InfluxExporter:
    def __init__(self):
        self.url = settings.INFLUXDB_URL
        self.token = settings.INFLUXDB_TOKEN
        self.org = settings.INFLUXDB_ORG
        self.bucket = settings.INFLUXDB_BUCKET
        self.client = None

    def _get_client(self) -> InfluxDBClient:
        if not self.client:
            self.client = InfluxDBClient(url=self.url, token=self.token, org=self.org)
        return self.client

    def write_node_metrics(self, server_id: str, server_name: str, node_data: Dict[str, Any]):
        try:
            client = self._get_client()
            write_api = client.write_api(write_options=SYNCHRONOUS)

            node_name = node_data.get("node") or node_data.get("name")
            status_val = 1 if node_data.get("status") == "online" or node_data.get("status") == 1 else 0

            point = Point("proxmox_node") \
                .tag("server_id", server_id) \
                .tag("server_name", server_name) \
                .tag("node_name", node_name) \
                .field("status", status_val) \
                .field("cpu", float(node_data.get("cpu", 0.0))) \
                .field("mem", int(node_data.get("mem", 0))) \
                .field("maxmem", int(node_data.get("maxmem", 0))) \
                .field("disk", int(node_data.get("disk", 0))) \
                .field("maxdisk", int(node_data.get("maxdisk", 0))) \
                .field("uptime", int(node_data.get("uptime", 0)))

            write_api.write(bucket=self.bucket, org=self.org, record=point)
        except Exception as e:
            logger.error(f"Failed to write node metrics to InfluxDB: {str(e)}")

    def write_guest_metrics(self, server_id: str, server_name: str, guest_data: Dict[str, Any]):
        try:
            client = self._get_client()
            write_api = client.write_api(write_options=SYNCHRONOUS)

            node_name = guest_data.get("node")
            vmid = str(guest_data.get("vmid"))
            name = guest_data.get("name", "unknown")
            guest_type = guest_data.get("type", "qemu")  # 'qemu' or 'lxc'
            status = guest_data.get("status", "stopped")

            point = Point("proxmox_guest") \
                .tag("server_id", server_id) \
                .tag("server_name", server_name) \
                .tag("node_name", node_name) \
                .tag("vmid", vmid) \
                .tag("name", name) \
                .tag("type", guest_type) \
                .field("status", status) \
                .field("cpu", float(guest_data.get("cpu", 0.0))) \
                .field("mem", int(guest_data.get("mem", 0))) \
                .field("maxmem", int(guest_data.get("maxmem", 0))) \
                .field("disk", int(guest_data.get("disk", 0))) \
                .field("maxdisk", int(guest_data.get("maxdisk", 0))) \
                .field("uptime", int(guest_data.get("uptime", 0)))

            write_api.write(bucket=self.bucket, org=self.org, record=point)
        except Exception as e:
            logger.error(f"Failed to write guest metrics to InfluxDB: {str(e)}")

    def close(self):
        if self.client:
            try:
                self.client.close()
                self.client = None
            except Exception as e:
                logger.error(f"Error closing InfluxDB client: {str(e)}")

influx_exporter = InfluxExporter()
