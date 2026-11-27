"""Account pool: hands out one Google account at a time, least-recently-used first.

An account is a saved browser login (Playwright storage_state JSON) in ACCOUNTS_DIR/<id>.json.
Each account is in one state:
  ready      can take a job
  busy       running a job right now (locked)
  cooldown   failed recently; comes back by itself at `until`
  paused     needs a human (signed out, out of credits, blocked). Only `resume()` brings it back.

Modelled on crawlgecko-service/service/session_pool.py (acquire / release / health / probation),
trimmed to what an image worker needs. State survives restarts in ACCOUNTS_DIR/_state.json.
"""
from __future__ import annotations

import json
import os
import threading
import time
from dataclasses import asdict, dataclass, field
from typing import Optional

COOLDOWN_SECONDS = int(os.getenv("ACCOUNT_COOLDOWN_SECONDS", "300"))
# after this many failures in a row a ready account is paused for a human instead of retried forever
MAX_CONSECUTIVE_FAILURES = int(os.getenv("ACCOUNT_MAX_FAILURES", "3"))


@dataclass
class Account:
    id: str
    state: str = "ready"           # ready | busy | cooldown | paused
    last_used: float = 0.0
    until: float = 0.0             # cooldown end (epoch seconds)
    failures: int = 0              # consecutive
    successes: int = 0
    reason: str = ""               # why paused / cooling down
    job: Optional[str] = None      # job id while busy
    extra: dict = field(default_factory=dict)


class AccountPool:
    def __init__(self, directory: str, now=time.time):
        self.dir = directory
        self.now = now
        self._lock = threading.Lock()
        self._accounts: dict[str, Account] = {}
        os.makedirs(directory, exist_ok=True)
        self.reload()

    # ---------- persistence ----------
    @property
    def _state_path(self) -> str:
        return os.path.join(self.dir, "_state.json")

    def storage_path(self, account_id: str) -> str:
        return os.path.join(self.dir, f"{account_id}.json")

    def reload(self) -> None:
        """Pick up account files that were added or removed, keeping saved state for the rest."""
        saved: dict = {}
        try:
            with open(self._state_path) as f:
                saved = json.load(f)
        except (OSError, ValueError):
            pass
        with self._lock:
            ids = sorted(f[:-5] for f in os.listdir(self.dir) if f.endswith(".json") and not f.startswith("_"))
            self._accounts = {}
            for i in ids:
                a = Account(id=i, **{k: v for k, v in saved.get(i, {}).items() if k in Account.__dataclass_fields__ and k != "id"})
                if a.state == "busy":          # the process died mid-job: not busy any more
                    a.state, a.job = "ready", None
                self._accounts[i] = a

    def _save(self) -> None:
        tmp = self._state_path + ".tmp"
        with open(tmp, "w") as f:
            json.dump({k: asdict(v) for k, v in self._accounts.items()}, f)
        os.replace(tmp, self._state_path)

    # ---------- rotation ----------
    def acquire(self, job_id: str, exclude: tuple[str, ...] = ()) -> Optional[Account]:
        """Least-recently-used ready account, locked for this job. None when nobody is free."""
        with self._lock:
            t = self.now()
            for a in self._accounts.values():
                if a.state == "cooldown" and a.until <= t:
                    a.state, a.reason = "ready", ""
            ready = [a for a in self._accounts.values() if a.state == "ready" and a.id not in exclude]
            if not ready:
                return None
            a = min(ready, key=lambda x: (x.last_used, x.id))
            a.state, a.job, a.last_used = "busy", job_id, t
            self._save()
            return Account(**asdict(a))

    def release_ok(self, account_id: str) -> None:
        with self._lock:
            a = self._accounts[account_id]
            a.state, a.job, a.failures, a.reason = "ready", None, 0, ""
            a.successes += 1
            self._save()

    def release_failed(self, account_id: str, reason: str, needs_human: bool = False) -> None:
        """Job failed on this account. needs_human = signed out / out of credits / blocked -> paused."""
        with self._lock:
            a = self._accounts[account_id]
            a.job, a.failures, a.reason = None, a.failures + 1, reason[:300]
            if needs_human or a.failures >= MAX_CONSECUTIVE_FAILURES:
                a.state = "paused"
            else:
                a.state, a.until = "cooldown", self.now() + COOLDOWN_SECONDS
            self._save()

    def resume(self, account_id: str) -> bool:
        with self._lock:
            a = self._accounts.get(account_id)
            if not a:
                return False
            a.state, a.failures, a.reason, a.job, a.until = "ready", 0, "", None, 0.0
            self._save()
            return True

    # ---------- reporting ----------
    def snapshot(self) -> list[dict]:
        """Safe to show in an admin page: no cookies, only state."""
        with self._lock:
            return [
                {"id": a.id, "state": a.state, "reason": a.reason, "failures": a.failures, "successes": a.successes,
                 "last_used": a.last_used, "cooldown_until": a.until if a.state == "cooldown" else None}
                for a in self._accounts.values()
            ]

    def usable_count(self) -> int:
        with self._lock:
            return sum(1 for a in self._accounts.values() if a.state in ("ready", "busy", "cooldown"))
