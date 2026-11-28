"""HTTP API of the Flow worker. Pixeldraw calls POST /generate and waits for the image URL."""
from __future__ import annotations

import hmac
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .driver import aspect_for_size, make_driver
from .jobs import JobManager
from .pool import AccountPool
from .storage import LocalStore, make_store

WAIT_SECONDS = float(os.getenv("GENERATE_WAIT_SECONDS", "240"))


class GenerateIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    size: Optional[str] = None                       # "1080x1920"
    aspect: Optional[str] = None                     # "9:16" (wins over size)
    attachments: list[str] = Field(default_factory=list, max_length=6)   # product photo / user attachments (http(s) or data: URLs)
    reference: Optional[str] = None                                      # ONE style reference (separate from attachments)
    referenceImages: list[str] = Field(default_factory=list, max_length=6)   # older callers: style references, only the first is used


def create_app(pool: Optional[AccountPool] = None, driver=None, store=None) -> FastAPI:
    pool = pool or AccountPool(os.getenv("ACCOUNTS_DIR", "./accounts"))
    store = store or make_store()
    mgr = JobManager(pool, driver or make_driver(), store)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        mgr.start()
        yield

    app = FastAPI(title="flow-worker", lifespan=lifespan)

    def auth(authorization: str = Header(default="")):
        token = os.getenv("WORKER_TOKEN", "")
        if not token:
            raise HTTPException(503, "WORKER_TOKEN is not set on the worker")
        given = authorization[7:] if authorization.startswith("Bearer ") else ""
        if not hmac.compare_digest(given, token):
            raise HTTPException(401, "bad token")

    @app.get("/health")
    def health():
        return {"ok": True, "accounts_usable": pool.usable_count(), "queued": mgr.queue.qsize()}

    @app.post("/generate", dependencies=[Depends(auth)])
    async def generate(body: GenerateIn):
        """Submit and wait. 200 {url} when done; 502 on failure; 504 {jobId} if it is still running."""
        aspect = body.aspect or aspect_for_size(body.size or "")
        rec = mgr.submit(body.prompt, aspect, body.attachments, body.reference or (body.referenceImages[0] if body.referenceImages else None))
        rec = await mgr.wait(rec.id, WAIT_SECONDS)
        if rec.status == "done":
            return {"url": rec.url, "jobId": rec.id, "attempts": rec.attempts}
        if rec.status == "failed":
            raise HTTPException(502, {"error": rec.error, "jobId": rec.id})
        raise HTTPException(504, {"error": "still_running", "jobId": rec.id})

    @app.post("/jobs", dependencies=[Depends(auth)])
    async def submit(body: GenerateIn):
        rec = mgr.submit(body.prompt, body.aspect or aspect_for_size(body.size or ""), body.attachments,
                         body.reference or (body.referenceImages[0] if body.referenceImages else None))
        return rec.public()

    @app.get("/jobs/{job_id}", dependencies=[Depends(auth)])
    async def job(job_id: str):
        rec = mgr.jobs.get(job_id)
        if not rec:
            raise HTTPException(404, "unknown job")
        return rec.public()

    @app.get("/accounts", dependencies=[Depends(auth)])
    def accounts():
        return pool.snapshot()

    @app.post("/accounts/reload", dependencies=[Depends(auth)])
    def reload_accounts():
        pool.reload()
        return pool.snapshot()

    @app.post("/accounts/{account_id}/resume", dependencies=[Depends(auth)])
    def resume(account_id: str):
        if not pool.resume(account_id):
            raise HTTPException(404, "unknown account")
        return {"ok": True}

    if isinstance(store, LocalStore):
        @app.get("/files/{name}")
        def files(name: str):
            if "/" in name or ".." in name:
                raise HTTPException(400, "bad name")
            path = os.path.join(store.dir, name)
            if not os.path.isfile(path):
                raise HTTPException(404)
            return FileResponse(path, media_type="image/png")

    app.state.pool, app.state.mgr = pool, mgr
    return app


app = create_app() if os.getenv("FLOW_WORKER_AUTOSTART", "1") == "1" else None
