"""Where finished images go. Cloudflare R2 when R2_* is set (same bucket settings as the Pixeldraw app),
otherwise a local folder served at /files (fine for development)."""
from __future__ import annotations

import asyncio
import os


class LocalStore:
    def __init__(self, directory: str, public_base: str):
        self.dir, self.base = directory, public_base.rstrip("/")
        os.makedirs(directory, exist_ok=True)

    async def save(self, png: bytes, name: str) -> str:
        with open(os.path.join(self.dir, f"{name}.png"), "wb") as f:
            f.write(png)
        return f"{self.base}/files/{name}.png"


class R2Store:
    def __init__(self):
        import boto3
        self.bucket = os.environ["R2_BUCKET_NAME"]
        self.public = os.environ["R2_PUBLIC_BASE_URL"].rstrip("/")
        self.client = boto3.client(
            "s3", region_name="auto",
            endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"], aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])

    async def save(self, png: bytes, name: str) -> str:
        key = f"flow/{name}.png"
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=key, Body=png, ContentType="image/png")
        return f"{self.public}/{key}"


def make_store():
    if os.getenv("R2_ACCOUNT_ID") and os.getenv("R2_BUCKET_NAME") and os.getenv("R2_PUBLIC_BASE_URL"):
        return R2Store()
    return LocalStore(os.getenv("FILES_DIR", "./files"), os.getenv("PUBLIC_BASE_URL", "http://localhost:8080"))
