import asyncio, base64, io, json, os, sys, time
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ["FLOW_WORKER_AUTOSTART"] = "0"
os.environ["WORKER_TOKEN"] = "secret"
os.environ["GENERATE_WAIT_SECONDS"] = "5"
os.environ["ACCOUNT_COOLDOWN_SECONDS"] = "60"

from fastapi.testclient import TestClient
from app.driver import Driver, MockDriver, NeedsHuman, Retryable, aspect_for_size
from app.jobs import JobManager, _is_public_host, fetch_reference
from app.main import create_app
from app.pool import AccountPool
from app.storage import LocalStore

H = {"Authorization": "Bearer secret"}


def make_pool(tmp_path, ids=("a", "b", "c"), clock=None):
    d = tmp_path / "acc"; d.mkdir()
    for i in ids: (d / f"{i}.json").write_text("{}")
    return AccountPool(str(d), now=clock or time.time)


class ScriptDriver(Driver):
    """Behaviour per account id (the storage file name). Records which accounts ran."""
    def __init__(self, script): self.script, self.ran = script, []
    async def generate(self, job, path):
        acct = os.path.basename(path)[:-5]; self.ran.append(acct)
        what = self.script.get(acct, "ok")
        if what == "human": raise NeedsHuman("signed out")
        if what == "retry": raise Retryable("page changed")
        return await MockDriver().generate(job, path)


def client(tmp_path, driver, pool):
    app = create_app(pool=pool, driver=driver, store=LocalStore(str(tmp_path / "f"), "http://t"))
    return TestClient(app), app


# ---------- pool ----------
def test_least_recently_used_rotation(tmp_path):
    t = [100.0]; pool = make_pool(tmp_path, clock=lambda: t[0])
    order = []
    for n in range(6):
        t[0] += 1
        a = pool.acquire(f"j{n}"); order.append(a.id); pool.release_ok(a.id)
    assert order == ["a", "b", "c", "a", "b", "c"]

def test_busy_account_not_handed_out_twice(tmp_path):
    pool = make_pool(tmp_path, ids=("a",))
    assert pool.acquire("j1").id == "a"
    assert pool.acquire("j2") is None

def test_failure_cools_down_then_returns(tmp_path):
    t = [0.0]; pool = make_pool(tmp_path, ids=("a",), clock=lambda: t[0])
    a = pool.acquire("j"); pool.release_failed(a.id, "boom")
    assert pool.acquire("j2") is None
    t[0] += 61
    assert pool.acquire("j3").id == "a"

def test_needs_human_pauses_until_resume(tmp_path):
    t = [0.0]; pool = make_pool(tmp_path, ids=("a",), clock=lambda: t[0])
    a = pool.acquire("j"); pool.release_failed(a.id, "signed out", needs_human=True)
    t[0] += 10_000
    assert pool.acquire("j2") is None and pool.snapshot()[0]["state"] == "paused"
    assert pool.resume("a") and pool.acquire("j3").id == "a"

def test_three_failures_in_a_row_pause(tmp_path):
    t = [0.0]; pool = make_pool(tmp_path, ids=("a",), clock=lambda: t[0])
    for _ in range(3):
        a = pool.acquire("j"); pool.release_failed(a.id, "x"); t[0] += 61
    assert pool.snapshot()[0]["state"] == "paused"

def test_state_survives_restart_and_busy_is_cleared(tmp_path):
    pool = make_pool(tmp_path, ids=("a", "b"))
    pool.acquire("j")                                   # a is busy, then the process "dies"
    again = AccountPool(pool.dir)
    states = {s["id"]: s["state"] for s in again.snapshot()}
    assert states == {"a": "ready", "b": "ready"}

def test_snapshot_has_no_cookies(tmp_path):
    pool = make_pool(tmp_path, ids=("a",))
    (tmp_path / "acc" / "a.json").write_text('{"cookies":[{"value":"SECRETCOOKIE"}]}')
    assert "SECRETCOOKIE" not in json.dumps(pool.snapshot())


# ---------- API ----------
def test_auth_required(tmp_path):
    c, _ = client(tmp_path, MockDriver(), make_pool(tmp_path))
    with c:
        assert c.post("/generate", json={"prompt": "x"}).status_code == 401
        assert c.post("/generate", json={"prompt": "x"}, headers={"Authorization": "Bearer nope"}).status_code == 401
        assert c.get("/accounts").status_code == 401
        assert c.get("/health").status_code == 200

def test_generate_returns_image_url_and_rotates(tmp_path):
    drv = ScriptDriver({}); c, _ = client(tmp_path, drv, make_pool(tmp_path))
    with c:
        urls = []
        for _ in range(3):
            r = c.post("/generate", json={"prompt": "a red shoe", "size": "1080x1920"}, headers=H)
            assert r.status_code == 200, r.text
            urls.append(r.json()["url"])
        assert len(set(urls)) == 3
        assert drv.ran == ["a", "b", "c"]
        name = urls[0].rsplit("/", 1)[1]
        img = c.get(f"/files/{name}"); assert img.status_code == 200 and img.content[:4] == b"\x89PNG"

def test_failure_moves_to_next_account(tmp_path):
    drv = ScriptDriver({"a": "retry"}); pool = make_pool(tmp_path); c, _ = client(tmp_path, drv, pool)
    with c:
        r = c.post("/generate", json={"prompt": "x"}, headers=H)
        assert r.status_code == 200 and r.json()["attempts"] == 2
        assert drv.ran == ["a", "b"]
        states = {s["id"]: s["state"] for s in pool.snapshot()}
        assert states["a"] == "cooldown" and states["b"] == "ready"

def test_signed_out_account_is_paused_and_job_still_succeeds(tmp_path):
    drv = ScriptDriver({"a": "human"}); pool = make_pool(tmp_path); c, _ = client(tmp_path, drv, pool)
    with c:
        assert c.post("/generate", json={"prompt": "x"}, headers=H).status_code == 200
        assert {s["id"]: s["state"] for s in pool.snapshot()}["a"] == "paused"
        assert c.post("/accounts/a/resume", headers=H).status_code == 200

def test_all_accounts_failing_gives_clear_error(tmp_path):
    drv = ScriptDriver({"a": "retry", "b": "retry", "c": "retry"}); c, _ = client(tmp_path, drv, make_pool(tmp_path))
    with c:
        r = c.post("/generate", json={"prompt": "x"}, headers=H)
        assert r.status_code == 502 and r.json()["detail"]["error"].startswith("failed_after_3")

def test_no_accounts_at_all(tmp_path):
    c, _ = client(tmp_path, MockDriver(), make_pool(tmp_path, ids=()))
    with c:
        r = c.post("/generate", json={"prompt": "x"}, headers=H)
        assert r.status_code == 502 and r.json()["detail"]["error"] == "no_accounts_available"

def test_reference_data_url_reaches_driver(tmp_path):
    seen = {}
    class D(MockDriver):
        async def generate(self, job, path):
            seen["files"] = job.reference_files; seen["sizes"] = [os.path.getsize(f) for f in job.reference_files]
            return await super().generate(job, path)
    from PIL import Image
    b = io.BytesIO(); Image.new("RGB", (8, 8), "red").save(b, "PNG")
    ref = "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    c, _ = client(tmp_path, D(), make_pool(tmp_path))
    with c:
        assert c.post("/generate", json={"prompt": "x", "referenceImages": [ref]}, headers=H).status_code == 200
    assert len(seen["files"]) == 1 and seen["sizes"][0] > 0

def test_private_reference_urls_refused_and_do_not_burn_the_account(tmp_path):
    pool = make_pool(tmp_path); c, _ = client(tmp_path, MockDriver(), pool)
    with c:
        r = c.post("/generate", json={"prompt": "x", "referenceImages": ["http://127.0.0.1:8080/secret"]}, headers=H)
        assert r.status_code == 502 and r.json()["detail"]["error"].startswith("bad_request")
        assert all(s["state"] == "ready" and s["failures"] == 0 for s in pool.snapshot())

def test_ssrf_helper():
    assert not _is_public_host("127.0.0.1") and not _is_public_host("localhost")
    assert not _is_public_host("169.254.169.254") and not _is_public_host("10.0.0.5")

def test_aspect_mapping():
    assert aspect_for_size("1080x1920") == "9:16" and aspect_for_size("1080x1080") == "1:1"
    assert aspect_for_size("1920x1080") == "16:9" and aspect_for_size("1080x1350") == "4:5" and aspect_for_size("junk") == "1:1"

def test_uncalibrated_flow_driver_stops_instead_of_guessing(tmp_path):
    from app.driver import PlaywrightFlowDriver, NeedsCalibration, Job
    with pytest.raises(NeedsCalibration):
        asyncio.run(PlaywrightFlowDriver().generate(Job("j", "x"), str(tmp_path / "a.json")))


def test_only_one_reference_reaches_the_driver(tmp_path):
    seen = {}
    class D(MockDriver):
        async def generate(self, job, path):
            seen["names"] = [os.path.basename(f) for f in job.reference_files]
            return await super().generate(job, path)
    from PIL import Image
    def ref(color):
        b = io.BytesIO(); Image.new("RGB", (8, 8), color).save(b, "PNG")
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    c, _ = client(tmp_path, D(), make_pool(tmp_path))
    with c:
        r = c.post("/generate", json={"prompt": "x", "referenceImages": [ref("red"), ref("blue"), ref("green")]}, headers=H)
        assert r.status_code == 200
    assert seen["names"] == ["ref0.png"]   # legacy referenceImages: only the first becomes the reference


def test_attachments_and_reference_are_separate(tmp_path, monkeypatch):
    import app.jobs as jobs; monkeypatch.setattr(jobs, "MAX_ATTACHMENTS", 2)   # prove they stay separate even if raised
    seen = {}
    class D(MockDriver):
        async def generate(self, job, path):
            b = os.path.basename
            seen["att"] = [b(f) for f in job.attachment_files]; seen["ref"] = b(job.reference_file) if job.reference_file else None
            seen["all"] = [b(f) for f in job.reference_files]
            return await super().generate(job, path)
    from PIL import Image
    def img(color):
        b = io.BytesIO(); Image.new("RGB", (8, 8), color).save(b, "PNG")
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    c, _ = client(tmp_path, D(), make_pool(tmp_path))
    with c:
        r = c.post("/generate", json={"prompt": "x", "attachments": [img("red"), img("blue")], "reference": img("green")}, headers=H)
        assert r.status_code == 200
    assert seen == {"att": ["att0.png", "att1.png"], "ref": "ref0.png", "all": ["att0.png", "att1.png", "ref0.png"]}

def test_no_reference_means_none(tmp_path):
    seen = {}
    class D(MockDriver):
        async def generate(self, job, path):
            seen["ref"] = job.reference_file; seen["n"] = len(job.reference_files); return await super().generate(job, path)
    c, _ = client(tmp_path, D(), make_pool(tmp_path))
    with c:
        assert c.post("/generate", json={"prompt": "x"}, headers=H).status_code == 200
    assert seen == {"ref": None, "n": 0}


def test_default_is_three_attachments_and_one_reference(tmp_path):
    seen = {}
    class D(MockDriver):
        async def generate(self, job, path):
            seen["att"] = len(job.attachment_files); seen["ref"] = 1 if job.reference_file else 0
            seen["all"] = len(job.reference_files); return await super().generate(job, path)
    from PIL import Image
    def img(color):
        b = io.BytesIO(); Image.new("RGB", (8, 8), color).save(b, "PNG")
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    c, _ = client(tmp_path, D(), make_pool(tmp_path))
    with c:
        four = [img("red"), img("blue"), img("black"), img("white")]
        r = c.post("/generate", json={"prompt": "x", "attachments": four, "reference": img("green")}, headers=H)
        assert r.status_code == 200
    assert seen == {"att": 3, "ref": 1, "all": 4}   # 4th attachment dropped; reference is separate
