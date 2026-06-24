#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# 华为 shixizhi 共享题库(内容版):SQLite + stdlib http.server,无第三方依赖。
# 存"正确选项的内容文本"(非字母,防选项乱序);搜题按题干模糊+精准,返回正确选项文本。
# 路由(经 nginx /feiyue-grinder-bank/ 反代):
#   GET  /search?q=<题干>&type=<题型>  -> {"texts":["..."],"qtype":"单选题","votes":3,"stem":"..."} 或 {"texts":null}
#   POST /add  {"stem","qtype","texts":["正确选项内容",...]}  -> {"ok":true,"votes":N}   (写 add_log 审计)
#   POST /del  {"token","stem"|"id"[,"qtype","ans_key"]}     -> {"ok":true,"deleted":N}  (需 BANK_ADMIN_TOKEN；写 del 审计)
#   GET  /log?token=&limit=N -> {"log":[...]}   (需 token；查看增/删审计)
#   GET  /stats -> {"rows":N,"stems":M}   GET /health -> {"ok":true}
import os, re, json, sqlite3, threading, urllib.parse, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB = os.environ.get("BANK_DB", "/data/bank.db")
PORT = int(os.environ.get("BANK_PORT", "8799"))
ADMIN_TOKEN = os.environ.get("BANK_ADMIN_TOKEN", "")  # /del 与 /log 需此 token；为空=禁用(防公网随意删库/看日志)
_lock = threading.Lock()
_PUNCT = re.compile(r"[\s　 ,.;:!?，。、；：！？（）()\[\]【】{}<>《》\"'`~·…—\-_/\\|=+*&^%$#@]+")

def norm(s):
    return _PUNCT.sub("", (s or "")).lower()

def ans_key(texts):
    return "|".join(sorted(norm(t) for t in texts if norm(t)))

def db():
    c = sqlite3.connect(DB, timeout=10)
    c.execute("PRAGMA journal_mode=WAL")
    return c

def init():
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    with db() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS answers(
            id INTEGER PRIMARY KEY,
            stem_norm TEXT NOT NULL,
            stem TEXT,
            qtype TEXT,
            ans_texts TEXT NOT NULL,   -- JSON 数组:正确选项内容
            ans_key TEXT NOT NULL,     -- 归一化排序拼接,用于去重
            votes INTEGER DEFAULT 1,
            updated_at TEXT,
            UNIQUE(stem_norm, ans_key))""")
        c.execute("CREATE INDEX IF NOT EXISTS idx_stem_norm ON answers(stem_norm)")
        c.execute("""CREATE TABLE IF NOT EXISTS add_log(
            id INTEGER PRIMARY KEY,
            ts TEXT, action TEXT, stem TEXT, qtype TEXT, texts TEXT, votes INTEGER, note TEXT)""")  # 增/删审计
        c.commit()

def _row_out(r):
    try:
        texts = json.loads(r[0])
    except Exception:
        texts = [r[0]] if r[0] else []
    return {"texts": texts, "qtype": r[1], "stem": r[2], "votes": r[3]}

def search(q, qtype=None):
    ns = norm(q)
    if len(ns) < 4:
        return None
    with db() as c:
        # 1) 精确归一化命中(同题干→同归一化),取票数最高 —— 最精准
        rows = c.execute("SELECT ans_texts,qtype,stem,votes,stem_norm FROM answers WHERE stem_norm=? ORDER BY votes DESC", (ns,)).fetchall()
        if not rows and len(ns) >= 8:
            # 2) 双向子串模糊,且长度比 >=0.82(很相近才算同题,保证精准)
            cand = c.execute("SELECT ans_texts,qtype,stem,votes,stem_norm FROM answers WHERE instr(stem_norm,?)>0 OR instr(?,stem_norm)>0", (ns, ns)).fetchall()
            def ratio(sn):
                a, b = len(sn), len(ns)
                return min(a, b) / max(a, b) if max(a, b) else 0
            rows = sorted((r for r in cand if ratio(r[4]) >= 0.82), key=lambda r: (ratio(r[4]), r[3]), reverse=True)
    return _row_out(rows[0]) if rows else None

def add(stem, qtype, texts):
    ns = norm(stem)
    texts = [t for t in (texts or []) if (t or "").strip()]
    if len(ns) < 4 or not texts:
        return None
    key = ans_key(texts)
    if not key:
        return None
    now = datetime.datetime.utcnow().isoformat()
    with _lock, db() as c:
        c.execute("""INSERT INTO answers(stem_norm,stem,qtype,ans_texts,ans_key,votes,updated_at)
                     VALUES(?,?,?,?,?,1,?)
                     ON CONFLICT(stem_norm,ans_key) DO UPDATE SET votes=votes+1, updated_at=excluded.updated_at,
                     stem=excluded.stem, qtype=excluded.qtype, ans_texts=excluded.ans_texts""",
                  (ns, (stem or "")[:1000], qtype or "", json.dumps(texts, ensure_ascii=False), key, now))
        c.commit()
        v = c.execute("SELECT votes FROM answers WHERE stem_norm=? AND ans_key=?", (ns, key)).fetchone()
    votes = v[0] if v else 1
    _log("add", stem, qtype, texts, votes)
    return votes

def _log(action, stem, qtype, texts, votes, note=""):
    try:
        with db() as c:
            c.execute("INSERT INTO add_log(ts,action,stem,qtype,texts,votes,note) VALUES(?,?,?,?,?,?,?)",
                      (datetime.datetime.utcnow().isoformat(), action, (stem or "")[:1000], qtype or "",
                       json.dumps(texts or [], ensure_ascii=False), votes, note))
            c.commit()
    except Exception:
        pass

def delete(stem=None, qtype=None, ans_key_val=None, row_id=None):
    with _lock, db() as c:
        if row_id is not None:
            n = c.execute("DELETE FROM answers WHERE id=?", (row_id,)).rowcount
        else:
            ns = norm(stem or "")
            if len(ns) < 1:
                return 0
            sql, args = "DELETE FROM answers WHERE stem_norm=?", [ns]
            if qtype: sql += " AND qtype=?"; args.append(qtype)
            if ans_key_val: sql += " AND ans_key=?"; args.append(ans_key_val)
            n = c.execute(sql, args).rowcount
        c.commit()
    _log("del", stem or ("#id=" + str(row_id)), qtype, [], n, "deleted=%d" % n)
    return n

def recent_log(limit=50):
    with db() as c:
        rows = c.execute("SELECT ts,action,qtype,votes,note,substr(stem,1,60) FROM add_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{"ts": r[0], "action": r[1], "qtype": r[2], "votes": r[3], "note": r[4], "stem": r[5]} for r in rows]

def stats():
    with db() as c:
        rows = c.execute("SELECT COUNT(*) FROM answers").fetchone()[0]
        stems = c.execute("SELECT COUNT(DISTINCT stem_norm) FROM answers").fetchone()[0]
    return {"rows": rows, "stems": stems}

class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_OPTIONS(self): self._send(204, {})
    def log_message(self, *a): pass
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); path = u.path.rstrip("/") or "/"; qs = urllib.parse.parse_qs(u.query)
        try:
            if path.endswith("/search"):
                r = search(qs.get("q", [""])[0], qs.get("type", [""])[0])
                return self._send(200, r if r else {"texts": None})
            if path.endswith("/stats"): return self._send(200, stats())
            if path.endswith("/log"):
                if not ADMIN_TOKEN or qs.get("token", [""])[0] != ADMIN_TOKEN: return self._send(403, {"error": "forbidden"})
                return self._send(200, {"log": recent_log(int(qs.get("limit", ["50"])[0] or 50))})
            if path.endswith("/health") or path == "/": return self._send(200, {"ok": True})
        except Exception as e:
            return self._send(500, {"error": str(e)[:200]})
        self._send(404, {"error": "not found"})
    def do_POST(self):
        u = urllib.parse.urlparse(self.path); path = u.path.rstrip("/") or "/"
        try:
            n = int(self.headers.get("Content-Length", "0")); raw = self.rfile.read(n) if n else b""
            data = json.loads(raw.decode("utf-8")) if raw else {}
            if path.endswith("/add"):
                texts = data.get("texts")
                if texts is None and data.get("answer_texts") is not None: texts = data.get("answer_texts")
                v = add(data.get("stem", ""), data.get("qtype", ""), texts or [])
                return self._send(200, {"ok": v is not None, "votes": v})
            if path.endswith("/del"):
                if not ADMIN_TOKEN or data.get("token") != ADMIN_TOKEN: return self._send(403, {"error": "forbidden"})
                n = delete(stem=data.get("stem"), qtype=data.get("qtype"), ans_key_val=data.get("ans_key"), row_id=data.get("id"))
                return self._send(200, {"ok": True, "deleted": n})
        except Exception as e:
            return self._send(500, {"error": str(e)[:200]})
        self._send(404, {"error": "not found"})

if __name__ == "__main__":
    init()
    print("feiyue-grinder-bank(content) on :%d db=%s" % (PORT, DB), flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), H).serve_forever()
