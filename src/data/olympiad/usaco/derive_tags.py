"""Extract broad algorithm tags from published USACO editorial wording."""
import concurrent.futures
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

INDEX = Path(__file__).with_name("index.json")
RULES = {
    "dynamic-programming": (r"dynamic programming", r"memoiz"),
    "greedy": (r"greedily", r"greedy"),
    "binary-search": (r"binary search",),
    "prefix-sums": (r"prefix sums?",),
    "graph-algorithms": (r"graph", r"breadth.first search", r"depth.first search", r"shortest path"),
    "trees": (r"tree",),
    "sorting": (r"sort(?:ing|ed)?",),
    "two-pointers": (r"two pointers?",),
    "data-structures": (r"segment tree", r"fenwick", r"priority queue", r"disjoint set", r"union.find"),
    "strings": (r"string", r"suffix array", r"trie"),
    "number-theory": (r"number theory", r"prime", r"gcd", r"modular arithmetic"),
    "geometry": (r"geometry", r"geometric", r"coordinate geometry"),
    "combinatorics": (r"combinatorics", r"combinatorial", r"permutation", r"combinations"),
    "simulation": (r"simulat(?:e|es|ed|ing|ion)",),
}


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def fetch(url):
    try:
        result = subprocess.run(["curl.exe", "-L", "-s", "--max-time", "12", url], capture_output=True,
                                text=True, encoding="utf-8", errors="replace", timeout=15)
        return result.stdout
    except Exception:
        return ""


def main():
    records = json.loads(INDEX.read_text(encoding="utf-8"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
        futures = {pool.submit(fetch, item["officialEditorialUrl"]): i for i, item in enumerate(records) if item.get("officialEditorialUrl")}
        for future in concurrent.futures.as_completed(futures):
            i = futures[future]
            parser = Text()
            parser.feed(future.result())
            text = " ".join(parser.parts).lower()
            records[i]["tags"] = [tag for tag, expressions in RULES.items()
                                   if any(re.search(expression, text) for expression in expressions)]
            records[i]["tagSourceUrl"] = records[i]["officialEditorialUrl"] if records[i]["tags"] else None
    INDEX.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tagged = sum(bool(item["tags"]) for item in records)
    print(f"derived editorial keyword tags for {tagged}/{len(records)} records")


if __name__ == "__main__":
    main()
