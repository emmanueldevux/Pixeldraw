"""Job queue. First in, first out. At most one job per account at a time, so the number of accounts
is the number of images that can be generated at once. A failed attempt moves to a different account."""
from __future__ import annotations

import asyncio
import base64
import ipaddress
import os
import socket
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urlparse

from .driver import Driver, Job, NeedsHuman, Retryable
from .pool import AccountPool

MAX_ATTEMPTS = int(os.getenv("JOB_MAX_ATTEMPTS", "3"))
QUEUE_TIMEOUT = float(os.getenv("JOB_QUEUE_TIMEOUT_SECONDS", "600"))   # waiting for a free account
MAX_ATTACHMENTS = int(os.getenv("FLOW_MAX_ATTACHMENTS", "3"))   # product photo + other attached images: up to 3 (extra ones are dropped, first wins)
MAX_REFS = 1                                                     # Flow takes ONE style reference; the first wins
MAX_REF_BYTES = 10 * 1024 * 1024


@dataclass
class Record:
    id: str
    prompt: str
    aspect: str
    attachments: list[str]
    reference: Optional[str] = None
    status: str = "queued"            # queued | running | done | failed
    attempts: int = 0
    tried: list[str] = field(default_factory=list)   # account ids already used (never shown to the app)
    url: Optional[str] = None
    error: Optional[str] = None
    created: float = field(default_factory=time.time)
    done: asyncio.Event = field(default_factory=asyncio.Event)

    def public(self) -> dict:
        return {"id": self.id, "status": self.status, "attempts": self.attempts, "url": self.url, "error": self.error}


def _is_public_host(host: str) -> bool:
    """Refuse localhost / private networks: the worker must not be a way into the server's own network."""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


async def fetch_reference(ref: str, directory: str, index: int, kind: str = "ref") -> str:
    """Download one reference (http(s) URL or data: URL) to a local file; returns its path."""
    if ref.startswith("data:"):
        head, _, b64 = ref.partition(",")
        data = base64.b64decode(b64)
        ext = "png" if "png" in head else "jpg" if ("jpeg" in head or "jpg" in head) else "webp" if "webp" in head else "png"
    else:
        import httpx
        u = urlparse(ref)
        if u.scheme not in ("http", "https") or not u.hostname or not _is_public_host(u.hostname):
            raise ValueError("reference URL not allowed")
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as c:
            r = await c.get(ref)
            r.raise_for_status()
            data = r.content
        ct = r.headers.get("content-type", "")
        ext = "png" if "png" in ct else "webp" if "webp" in ct else "jpg"
    if len(data) > MAX_REF_BYTES:
        raise ValueError("reference image too large")
    path = os.path.join(directory, f"{kind}{index}.{ext}")
    with open(path, "wb") as f:
        f.write(data)
    return path


class JobManager:
    def __init__(self, pool: AccountPool, driver: Driver, store):
        self.pool, self.driver, self.store = pool, driver, store
        self.jobs: dict[str, Record] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self._dispatcher: Optional[asyncio.Task] = None

    def start(self) -> None:
        if not self._dispatcher:
            self._dispatcher = asyncio.create_task(self._dispatch())

    def submit(self, prompt: str, aspect: str, attachments: list[str], reference: Optional[str] = None) -> Record:
        """attachments = the user's product photo / attached images; reference = ONE style reference (separate thing)."""
        rec = Record(id=uuid.uuid4().hex[:16], prompt=prompt, aspect=aspect,
                     attachments=attachments[:MAX_ATTACHMENTS], reference=reference or None)
        self.jobs[rec.id] = rec
        self.queue.put_nowait(rec.id)
        self._trim()
        return rec

    def _trim(self) -> None:
        """Keep the last ~500 finished jobs so memory stays flat."""
        finished = [j for j in self.jobs.values() if j.status in ("done", "failed")]
        for j in sorted(finished, key=lambda x: x.created)[:-500]:
            self.jobs.pop(j.id, None)

    async def _dispatch(self) -> None:
        while True:
            jid = await self.queue.get()
            rec = self.jobs.get(jid)
            if not rec or rec.status != "queued":
                continue
            deadline = rec.created + QUEUE_TIMEOUT
            acct = None
            while acct is None:
                if self.pool.usable_count() == 0:
                    self._fail(rec, "no_accounts_available")
                    break
                acct = self.pool.acquire(rec.id, exclude=tuple(rec.tried))
                if acct is None:
                    if time.time() > deadline:
                        self._fail(rec, "queue_timeout")
                        break
                    # every account is busy / cooling / already tried for this job
                    if rec.tried and all(a["id"] in rec.tried or a["state"] == "paused" for a in self.pool.snapshot()):
                        self._fail(rec, "all_accounts_failed")
                        break
                    await asyncio.sleep(1)
            if acct is not None:
                rec.status, rec.attempts = "running", rec.attempts + 1
                asyncio.create_task(self._run(rec, acct.id))

    def _fail(self, rec: Record, why: str) -> None:
        rec.status, rec.error = "failed", why
        rec.done.set()

    async def _run(self, rec: Record, account_id: str) -> None:
        tmp = tempfile.mkdtemp(prefix="flowjob_")
        try:
            att = [await fetch_reference(r, tmp, i, "att") for i, r in enumerate(rec.attachments)]
            ref = await fetch_reference(rec.reference, tmp, 0, "ref") if rec.reference else None
            job = Job(rec.id, rec.prompt, rec.aspect, reference_files=att + ([ref] if ref else []),
                      attachment_files=att, reference_file=ref)
            png = await self.driver.generate(job, self.pool.storage_path(account_id))
            rec.url = await self.store.save(png, rec.id)
            self.pool.release_ok(account_id)
            rec.status = "done"
            rec.done.set()
        except ValueError as e:                      # bad reference: the account is fine, the request is not
            self.pool.release_ok(account_id)
            self._fail(rec, f"bad_request: {e}")
        except NeedsHuman as e:
            self.pool.release_failed(account_id, str(e), needs_human=True)
            self._retry_or_fail(rec, account_id, str(e))
        except Exception as e:                       # Retryable and anything unexpected
            self.pool.release_failed(account_id, f"{type(e).__name__}: {e}")
            self._retry_or_fail(rec, account_id, f"{type(e).__name__}: {e}")
        finally:
            import shutil
            shutil.rmtree(tmp, ignore_errors=True)

    def _retry_or_fail(self, rec: Record, account_id: str, why: str) -> None:
        rec.tried.append(account_id)
        if rec.attempts >= MAX_ATTEMPTS:
            self._fail(rec, f"failed_after_{rec.attempts}_attempts")
        else:
            rec.status = "queued"
            self.queue.put_nowait(rec.id)

    async def wait(self, jid: str, timeout: float) -> Record:
        rec = self.jobs[jid]
        try:
            await asyncio.wait_for(rec.done.wait(), timeout)
        except asyncio.TimeoutError:
            pass
        return rec
