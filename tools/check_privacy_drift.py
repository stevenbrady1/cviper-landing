#!/usr/bin/env python3
"""Fail when privacy/index.html no longer says what the app's policy says.

WHY THIS EXISTS
---------------
privacy/index.html is a transcription. Its source of truth lives in a
different repository:

    stevenbrady1/cviper-light : docs/app-store/privacy-policy.md

That file is itself generated from the app's host registry and kept
byte-identical to the app's own render by `policyDocument.test.ts`. Nothing
linked the two repositories, so the page drifted silently and did: four
separate app changes (L-92, L-105, L-106, L-110) landed while this site still
described the old behaviour, including two live hosts the page did not name at
all -- on a page whose central claim is "this is not a summary".

WHAT IT CHECKS
--------------
Every block of the published policy -- heading, paragraph and bullet -- must
appear verbatim in the RENDERED TEXT of privacy/index.html, after markdown
syntax and HTML tags are removed and whitespace is normalised. Extra text on
the page is allowed: the page carries two sections the generated policy has no
reason to cover ("Taking your data with you", "This website"), and a site-only
lede. Missing or altered policy text is a failure.

This is deliberately a containment check and not an equality check, because
the page is a styled transcription, not a copy of the markdown.

HOW TO FIX A FAILURE
--------------------
Do not edit this script, and do not soften the check. Regenerate the page:

    1. Read the current policy:
       https://raw.githubusercontent.com/stevenbrady1/cviper-light/main/docs/app-store/privacy-policy.md
    2. Update privacy/index.html so its visible text carries every block of it,
       keeping the existing structure, styling and provenance comment.
    3. Update the SOURCE STAMP comment in privacy/index.html (last-changed
       commit, main SHA, sha256 -- this script prints all three).
    4. Re-run:  python tools/check_privacy_drift.py

A red window between an app-repo merge and that regeneration is the correct
signal, not a nuisance. There are no grace periods, retries or tolerances here
on purpose.

USAGE
-----
    python tools/check_privacy_drift.py              # fetch from cviper-light main
    python tools/check_privacy_drift.py --policy F   # compare against a local file
    python tools/check_privacy_drift.py --page P     # check a different HTML file

Exit codes: 0 in sync, 1 drifted, 2 could not read one of the two inputs.
Standard library only; no third-party dependency to install or pin.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

REPO = "stevenbrady1/cviper-light"
POLICY_PATH = "docs/app-store/privacy-policy.md"
POLICY_URL = f"https://raw.githubusercontent.com/{REPO}/main/{POLICY_PATH}"
COMMITS_API = f"https://api.github.com/repos/{REPO}/commits?path={POLICY_PATH}&sha=main&per_page=1"

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PAGE = ROOT / "privacy" / "index.html"

TIMEOUT = 30
USER_AGENT = "cviper-landing privacy-drift-check"

# Tags whose boundaries are NOT word boundaries. Replacing these with nothing
# keeps "<a>...issues</a>." rendering as "issues." and not "issues ."; every
# other tag becomes a single space so block elements do not glue together.
INLINE_TAGS = {"a", "span", "strong", "em", "b", "i", "code", "small",
               "abbr", "sup", "sub", "u", "mark", "time", "wbr"}

ENTITIES = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
    "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&mdash;": "—",
    "&ndash;": "–", "&hellip;": "…", "&copy;": "©",
    "&middot;": "·", "&rarr;": "→",
}


def normalise(text: str) -> str:
    """One spelling for characters that differ only typographically."""
    text = unicodedata.normalize("NFC", text)
    for src, dst in (("’", "'"), ("‘", "'"), ("“", '"'),
                     ("”", '"'), ("′", "'"), (" ", " "),
                     ("‑", "-"), ("​", "")):
        text = text.replace(src, dst)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([.,;:!?])", r"\1", text)
    return text.strip()


def render_html(html: str) -> tuple[str, list[str]]:
    """Return (visible text, per-block visible text) for an HTML document."""
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    html = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<head\b.*?</head>", " ", html, flags=re.S | re.I)

    def strip_tag(match: re.Match[str]) -> str:
        name = match.group(1).lower()
        return "" if name in INLINE_TAGS else " "

    # A marker only between block elements, so blocks can be listed separately
    # while the joined text still reads as one flowing document.
    marked = re.sub(r"</?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>",
                    lambda m: strip_tag(m) if m.group(1).lower() in INLINE_TAGS
                    else "\x00", html)
    for entity, char in ENTITIES.items():
        marked = marked.replace(entity, char)
    marked = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), marked)

    blocks = [normalise(part) for part in marked.split("\x00")]
    blocks = [block for block in blocks if block]
    return normalise(" ".join(blocks)), blocks


def policy_blocks(markdown: str) -> list[str]:
    """Every statement the policy makes: headings, paragraphs, bullets.

    The level-1 heading is skipped on purpose: it is the document's title, and
    the page renders it as an eyebrow plus an <h1> with different casing. Every
    other line is compared verbatim.
    """
    statements: list[str] = []
    buffer: list[str] = []

    def flush() -> None:
        if buffer:
            statements.append(" ".join(buffer))
            buffer.clear()

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            flush()
            continue
        if line.startswith("#"):
            flush()
            level = len(line) - len(line.lstrip("#"))
            if level > 1:
                statements.append(line.lstrip("#").strip())
            continue
        if line.lstrip().startswith(("- ", "* ")):
            flush()
            buffer.append(line.lstrip()[2:].strip())
            continue
        buffer.append(line.strip())
    flush()

    cleaned: list[str] = []
    for statement in statements:
        text = statement.replace("`", "")
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"^_(.+)_$", r"\1", text.strip())
        text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
        text = normalise(text)
        if text:
            cleaned.append(text)
    return cleaned


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return response.read()


def upstream_commit() -> dict[str, str] | None:
    """Newest commit touching the policy. Informational; never fails the run.

    The hard gate is the text comparison below. This only prints what to write
    into the page's SOURCE STAMP comment after a regeneration, and is wrapped
    because the unauthenticated GitHub API is rate-limited per IP and a shared
    runner can be throttled through no fault of this repository.
    """
    try:
        payload = json.loads(fetch(COMMITS_API).decode("utf-8"))
        head = payload[0]
        return {
            "sha": head["sha"],
            "date": head["commit"]["committer"]["date"],
            "message": head["commit"]["message"].splitlines()[0],
        }
    except Exception as error:  # noqa: BLE001 - informational only
        print(f"  (could not read the upstream commit: {error})")
        return None


def report_drift(missing: list[str], blocks: list[str]) -> None:
    print()
    print(f"DRIFT: {len(missing)} statement(s) of the published policy are not "
          f"in the rendered text of this page.")
    for statement in missing:
        closest = difflib.get_close_matches(statement, blocks, n=1, cutoff=0.4)
        print()
        print("-" * 72)
        print("POLICY SAYS:")
        print(f"  {statement}")
        if closest:
            print("NEAREST TEXT ON THE PAGE:")
            print(f"  {closest[0]}")
            print("DIFF (- policy, + page):")
            diff = difflib.unified_diff(
                statement.split(), closest[0].split(),
                lineterm="", n=3, fromfile="policy", tofile="page")
            print("  " + " ".join(line for line in diff
                                  if line.startswith(("+", "-"))
                                  and not line.startswith(("---", "+++"))))
        else:
            print("NOTHING ON THE PAGE RESEMBLES IT - the statement is absent.")
    print("-" * 72)


def main() -> int:
    # The policy is full of arrows and em dashes. A Windows console defaults to
    # cp1252 and would crash mid-report on the first one -- turning a real
    # failure into a traceback that looks like a broken script.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):  # pragma: no cover - older interpreters
        pass

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--policy", help="local markdown file instead of the "
                                         "published one (for testing)")
    parser.add_argument("--page", default=str(DEFAULT_PAGE),
                        help="the HTML page to check")
    args = parser.parse_args()

    page_path = Path(args.page)
    try:
        html = page_path.read_text(encoding="utf-8")
    except OSError as error:
        print(f"ERROR: cannot read {page_path}: {error}")
        return 2

    if args.policy:
        try:
            markdown_bytes = Path(args.policy).read_bytes()
        except OSError as error:
            print(f"ERROR: cannot read {args.policy}: {error}")
            return 2
        source = args.policy
    else:
        try:
            markdown_bytes = fetch(POLICY_URL)
        except (urllib.error.URLError, urllib.error.HTTPError, OSError) as error:
            print(f"ERROR: cannot read the published policy: {error}")
            print(f"       {POLICY_URL}")
            print("       This check cannot pass without it. It is not a "
                  "reason to skip the check.")
            return 2
        source = POLICY_URL

    markdown = markdown_bytes.decode("utf-8")
    digest = hashlib.sha256(markdown_bytes).hexdigest()

    print(f"policy : {source}")
    print(f"sha256 : {digest}")
    print(f"page   : {page_path}")
    if not args.policy:
        head = upstream_commit()
        if head:
            print(f"commit : {head['sha']}  {head['date']}")
            print(f"         {head['message']}")
            stamped = re.search(r"last changed\s+([0-9a-f]{40})", html)
            if stamped and stamped.group(1) != head["sha"]:
                print(f"  note : the page's SOURCE STAMP names "
                      f"{stamped.group(1)[:12]}, which is no longer the newest "
                      f"commit to touch that file. Informational only - the "
                      f"text comparison below is what passes or fails.")

    rendered, blocks = render_html(html)
    statements = policy_blocks(markdown)
    missing = [s for s in statements if s not in rendered]

    print(f"checked: {len(statements)} policy statements against "
          f"{len(rendered)} characters of rendered page text")

    if missing:
        report_drift(missing, blocks)
        print()
        print("The page is stale. Regenerate it from the policy above - the "
              "steps are in this file's docstring and in README.md.")
        return 1

    print("OK: every statement in the published policy is on the page.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
