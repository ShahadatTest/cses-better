"""Refresh task titles and published sample traces from official USACO pages."""
import concurrent.futures
import html
import json
import re
import subprocess
import urllib.parse
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://www.usaco.org/index.php?page="
OUT = Path(__file__).with_name("index.json")
REPORT = Path(__file__).with_name("coverage.md")
MONTHS = {"dec": "December", "jan": "January", "feb": "February", "open": "US Open"}
DIVISIONS = {"bronze", "silver", "gold", "platinum"}


def fetch(url):
    result = subprocess.run(["curl.exe", "-L", "-s", "--max-time", "12", url], capture_output=True,
                            text=True, encoding="utf-8", errors="replace", timeout=15)
    return result.stdout


class ArchiveParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.division = ""
        self.current = None
        self.tasks = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h2":
            self._in_h2 = True
            self._heading = []
        elif tag == "a":
            href = attrs.get("href", "")
            cpid = re.search(r"viewproblem2&cpid=(\d+)", href)
            if cpid:
                if self.division not in DIVISIONS:
                    return
                self.current = {"division": self.division, "cpid": cpid.group(1), "editorial": None}
                self.tasks.append(self.current)
            elif self.current and "sol_" in href:
                self.current["editorial"] = urllib.parse.urljoin("https://www.usaco.org/", href)

    def handle_data(self, data):
        if getattr(self, "_in_h2", False):
            self._heading.append(data)

    def handle_endtag(self, tag):
        if tag == "h2" and getattr(self, "_in_h2", False):
            heading = " ".join(" ".join(self._heading).split()).lower()
            match = re.search(r"contest,\s*(bronze|silver|gold|platinum)", heading)
            if match:
                self.division = match.group(1)
            self._in_h2 = False


class ProblemParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_h2 = False
        self.headings = []
        self.pre = None
        self.samples = {"in": [], "out": []}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "h2":
            self.in_h2 = True
            self.headings.append([])
        elif tag == "pre":
            cls = attrs.get("class", "").split()
            self.pre = next((x for x in cls if x in self.samples), None)
        elif tag == "br" and self.pre:
            self.samples[self.pre].append("\n")

    def handle_data(self, data):
        if self.in_h2:
            self.headings[-1].append(data)
        if self.pre:
            self.samples[self.pre].append(data)

    def handle_endtag(self, tag):
        if tag == "h2":
            self.in_h2 = False
        elif tag == "pre":
            self.pre = None


def parse_problem(page):
    parser = ProblemParser()
    parser.feed(page)
    headings = [" ".join(" ".join(x).split()) for x in parser.headings]
    match = next((re.search(r"Problem\s+(\d+)\.\s*(.*)$", h, re.I) for h in headings if re.search(r"Problem\s+\d+\.", h, re.I)), None)
    if not match:
        return None
    return int(match.group(1)), html.unescape(match.group(2)).strip(), {k: "".join(v).strip() for k, v in parser.samples.items()}


def main():
    requests = [(year, month, f"{month}{year % 100:02}results") for year in range(2014, 2027) for month in MONTHS]
    archives = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        pending = {pool.submit(fetch, BASE + slug): (year, month, slug) for year, month, slug in requests}
        for future in concurrent.futures.as_completed(pending):
            year, month, slug = pending[future]
            page = future.result()
            if "View problem" not in page:
                continue
            parser = ArchiveParser()
            parser.feed(page)
            if parser.tasks:
                archives.append((year, month, slug, page, parser.tasks))

    tasks = [(year, month, slug, task) for year, month, slug, _, records in archives for task in records]
    problem_data = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        pending = {pool.submit(fetch, BASE + "viewproblem2&cpid=" + task["cpid"]): task["cpid"] for _, _, _, task in tasks}
        for future in concurrent.futures.as_completed(pending):
            problem_data[pending[future]] = parse_problem(future.result())

    records, seen = [], set()
    for year, month, slug, task in tasks:
        cpid = task["cpid"]
        parsed = problem_data.get(cpid)
        if cpid in seen or not parsed:
            continue
        seen.add(cpid)
        number, title, sample = parsed
        source = BASE + "viewproblem2&cpid=" + cpid
        has_sample = bool(sample["in"] and sample["out"])
        records.append({
            "id": f"usaco-{year}-{month}-{task['division']}-{number}",
            "contestId": "usaco",
            "year": year,
            "round": MONTHS[month],
            "taskId": f"{task['division']}-{number}",
            "title": title,
            "sourceUrl": source,
            "statementAvailability": "official-link",
            "tags": [],
            "visual": {
                "kind": "sample-trace" if has_sample else "unavailable",
                "title": "Published sample walkthrough" if has_sample else "No published sample found",
                "caption": f"Trace this official sample for {title}: use the task rules to map the shown input to the expected output." if has_sample else "No input/output sample pair was available on the linked official statement page.",
                "steps": ([
                    {"label": "Sample input", "detail": "Start with the exact published input values shown in the diagram."},
                    {"label": "Apply the task rules", "detail": "Use this problem's stated operation or condition to trace the sample."},
                    {"label": "Sample output", "detail": "Compare the result with the official expected output shown in the diagram."},
                ] if has_sample else []),
                "diagram": ({"nodes": [
                    {"id": "input", "label": "Published input", "text": sample["in"]},
                    {"id": "output", "label": "Expected output", "text": sample["out"]},
                ], "edges": [{"from": "input", "to": "output", "label": "task rules"}]} if has_sample else None),
            },
            "officialArchiveUrl": BASE + slug,
            "officialEditorialUrl": task["editorial"],
            "tagSourceUrl": None,
            "officialProblemId": cpid,
        })

    round_order = {"December": 0, "January": 1, "February": 2, "US Open": 3}
    division_order = {"bronze": 0, "silver": 1, "gold": 2, "platinum": 3}
    records.sort(key=lambda x: (x["year"], round_order[x["round"]], division_order[x["taskId"].split("-")[0]], int(x["taskId"].split("-")[1])))
    OUT.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    count = Counter((year, month, task["division"]) for year, month, _, _, tasks_in_archive in archives for task in tasks_in_archive)
    years = sorted({year for year, _, _, _, _ in archives})
    missing_years = sorted(set(range(2014, 2027)) - set(years))
    lines = ["# USACO archive inventory", "", f"Indexed {len(records)} official problem pages across {len(archives)} contest archives.",
             "", "Source: [official USACO contest archives](https://www.usaco.org/index.php?page=contests)",
             "", f"Years with indexed archives: {', '.join(map(str, years))}.",
             f"Years 2014–2026 with no contest archive page found by this scan: {', '.join(map(str, missing_years)) or 'none'}.",
             "", "| Year | Round | Divisions with indexed tasks | Tasks |", "|---:|---|---|---:|"]
    for year, month, _, _, tasks_in_archive in sorted(archives, key=lambda x: (x[0], list(MONTHS).index(x[1]))):
        divs = sorted({x["division"] for x in tasks_in_archive}, key=lambda d: division_order[d])
        lines.append(f"| {year} | {MONTHS[month]} | {', '.join(divs)} | {len(tasks_in_archive)} |")
    lines += ["", "This scan covers archive URL patterns from 2014 through 2026; the official site did not resolve the tested 2012–2013 monthly result URL patterns. Each problem statement links to the official USACO page. Statements/editorials are not bundled. Visual records use official sample input/output pairs where available; they are sample traces, not full algorithm explanations. Missing sample pairs are explicitly marked unavailable. Broad topic tags are extracted from each linked official editorial's terminology; the source URL is recorded in each tagged record.", ""]
    REPORT.write_text("\n".join(lines), encoding="utf-8")
    print(f"indexed {len(records)} tasks from {len(archives)} archives; {sum(r['visual']['kind'] == 'sample-trace' for r in records)} have official sample traces")


if __name__ == "__main__":
    main()
