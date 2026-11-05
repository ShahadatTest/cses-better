# IARCS Indian Olympiad archive inventory

The official [IARCS archive index](https://www.iarcs.org.in/inoi/archives.php) lists annual archives from 2002 through 2026. Each of the 25 year pages was reachable during this inventory. [`archive-coverage.json`](./archive-coverage.json) records those pages and 147 directly linked PDFs or problem-platform links without copying their statements.

[`index.json`](./index.json) contains 85 verified task records with official source links and original visual explanations: 16 INOI problems from 2004–2011, 44 ZCO/INOI tasks from 2012–2021, ZIO tasks from 2022–2026, plus ZCO and INOI tasks from 2024. ZIO records without a published problem title use concise descriptive labels.

[`task-coverage.json`](./task-coverage.json) records per-year task counts and known gaps. [`codechef-source-audit.json`](./codechef-source-audit.json) identifies linked statements that return generic authoring templates or truncated content; these are not imported as tasks. INOI 2002 could not be verified because PDF text extraction was garbled. The 2022 ZCO question PDF text was not extractable, and the 2025 ZCO/INOI Codeforces gyms were inaccessible during the crawl. The archive pages do not state a blanket redistribution license, so this catalog links to original statements rather than mirroring them.

Task-level coverage is incomplete for ZIO papers from 2002–2011 and for sources that could not be retrieved or verified. The 2003 official archive page lists no INOI paper.
