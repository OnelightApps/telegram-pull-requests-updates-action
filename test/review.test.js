const test = require("node:test");
const assert = require("node:assert");
const { singleComment, formatCommentList, escapeMarkdown, clip } = require("../lib/review");
const { retryDelay } = require("../lib/send_message");

const comment = (n, extra = {}) => ({ body: `**Finding** ${n}.\nDetails`, path: "Sources/A.swift", html_url: `https://x/c${n}`, ...extra });

test("a thread reply is sent as the comment", () => {
  const reply = comment(1, { in_reply_to_id: 7 });
  assert.strictEqual(singleComment({ body: "", state: "commented" }, [reply]), reply);
  assert.strictEqual(singleComment({ body: null, state: "COMMENTED" }, [reply]), reply);
});

test("a review with text, a verdict or several comments stays a review", () => {
  assert.strictEqual(singleComment({ body: "Summary", state: "commented" }, [comment(1)]), undefined);
  assert.strictEqual(singleComment({ body: "", state: "approved" }, [comment(1)]), undefined);
  assert.strictEqual(singleComment({ body: "", state: "commented" }, [comment(1), comment(2)]), undefined);
  assert.strictEqual(singleComment({ body: "", state: "approved" }, []), undefined);
});

test("the list shows the first comments and counts the rest", () => {
  const list = formatCommentList(Array.from({ length: 26 }, (_, i) => comment(i + 1)));
  assert.match(list, /^\*Comments \\\(26\\\):\*/);
  assert.strictEqual((list.match(/^• /gm) || []).length, 5);
  assert.ok(list.includes("• [A\\.swift](https://x/c1) Finding 1\\.\n"), list);
  assert.match(list, /…and 21 more$/);
  assert.strictEqual(formatCommentList([]), "");
  assert.strictEqual(formatCommentList([comment(1), comment(2)], 0), "*Comments \\(2\\):*\n…and 2 more");
  assert.ok(formatCommentList([comment(1, { body: "`feed_age_days` is **wrong**" })]).includes("feed\\_age\\_days is wrong"));
});

test("escaping and clipping keep MarkdownV2 valid", () => {
  assert.strictEqual(escapeMarkdown("a\\.b"), "a\\\\\\.b");
  assert.strictEqual(clip("ab😀c", 3), "ab😀…");
  assert.strictEqual(clip("ab😀", 2), "ab…");
  const list = formatCommentList([comment(1, { body: "```suggestion\nUse `__init__` here **now**" })]);
  assert.ok(list.includes(") Use \\_\\_init\\_\\_ here now"), list);
  assert.ok(formatCommentList([comment(1, { body: "<!-- marker -->\nReal text" })]).includes(") Real text"));
});

const axiosError = (status, data) => ({ isAxiosError: true, response: status && { status, data } });

test("429 waits as Telegram asks, other client errors are final", () => {
  assert.strictEqual(retryDelay(axiosError(429, { parameters: { retry_after: 5 } }), 1), 6);
  assert.strictEqual(retryDelay(axiosError(429, { parameters: { retry_after: 500 } }), 1), 60);
  assert.strictEqual(retryDelay(axiosError(429, {}), 4), 6);
  assert.strictEqual(retryDelay(axiosError(429, {}), 5), undefined);
  assert.strictEqual(retryDelay(axiosError(400, {}), 1), undefined);
  assert.strictEqual(retryDelay(axiosError(502, {}), 2), 6);
  assert.strictEqual(retryDelay(axiosError(undefined), 1), 3);
  assert.strictEqual(retryDelay(new Error("x"), 1), undefined);
});
