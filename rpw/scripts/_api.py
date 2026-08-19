"""Small HTTP helper shared by the RPW provisioning scripts.

Deliberately stdlib-only: these scripts run from cron and from a fresh clone on a
new host, where installing Python packages is one more thing to go wrong.

(`smoke_test.py` intentionally does NOT use this module — a smoke test that
shares its plumbing with the code under test is worth less.)
"""

import json
import os
import re
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("RPW_BASE_URL", "http://localhost:8080").rstrip("/")
API = f"{BASE_URL}/api"


class Api:
    def __init__(self, base_url=None):
        self.base = (base_url or BASE_URL).rstrip("/")
        self.api = f"{self.base}/api"
        self.token = None
        self.org_id = None

    # ── plumbing ────────────────────────────────────────────────────────────
    def request(
        self,
        method,
        path,
        body=None,
        headers=None,
        raw=False,
        timeout=120,
        body_bytes=None,
    ):
        url = path if path.startswith("http") else f"{self.api}{path}"
        # body_bytes carries an already-encoded payload (multipart uploads);
        # body is the usual JSON case.
        data = (
            body_bytes
            if body_bytes is not None
            else (json.dumps(body).encode() if body is not None else None)
        )
        hdrs = {"Content-Type": "application/json"}
        if self.token:
            hdrs["Authorization"] = f"Bearer {self.token}"
        if self.org_id:
            hdrs["organization-id"] = self.org_id
        hdrs.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = resp.read()
                if raw:
                    return resp.status, payload
                return resp.status, json.loads(payload) if payload else None
        except urllib.error.HTTPError as exc:
            payload = exc.read()
            try:
                return exc.code, json.loads(payload)
            except Exception:
                return exc.code, payload.decode(errors="replace")

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, body, **kw):
        return self.request("POST", path, body, **kw)

    # ── conveniences ────────────────────────────────────────────────────────
    @staticmethod
    def pick(body, *names):
        """Read a field tolerating camelCase/snake_case and a `data` envelope."""
        sources = []
        if isinstance(body, dict):
            sources.append(body)
            if isinstance(body.get("data"), dict):
                sources.append(body["data"])
        for source in sources:
            for name in names:
                snake = re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()
                for key in (name, snake):
                    if key in source:
                        return source[key]
        return None

    def wait_until_up(self, minutes=5):
        deadline = time.time() + minutes * 60
        while time.time() < deadline:
            try:
                status, _ = self.request("GET", "/auth/meta", timeout=10)
                if status < 500:
                    return True
            except Exception:
                pass
            time.sleep(3)
        raise RuntimeError(f"the API at {self.api} never became reachable")

    def sign_in(self, email, password):
        status, body = self.post("/auth/signin", {"email": email, "password": password})
        if status not in (200, 201):
            raise RuntimeError(f"sign-in failed ({status}): {body}")
        self.token = self.pick(body, "accessToken", "access_token")
        self.org_id = str(self.pick(body, "organizationId", "organization_id"))
        return self.token, self.org_id


def color(code, text):
    return f"\033[{code}m{text}\033[0m"


def ok(msg):
    print(f"  {color('32', 'OK')}   {msg}")


def skip(msg):
    print(f"  {color('90', '--')}   {msg}")


def step(msg):
    print(f"\n{color('1', msg)}")


def fail(msg, detail=None):
    print(f"  {color('31', 'FAIL')} {msg}")
    if detail is not None:
        print(f"       {str(detail)[:600]}")
    raise SystemExit(1)
