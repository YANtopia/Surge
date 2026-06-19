/*
 * Claude 可用性检测面板脚本
 * 检测 api.anthropic.com 与 claude.ai 是否可正常访问
 * 通过指定策略组出口发起请求（默认 Claude 组）
 *
 * 判断逻辑：
 *  - Anthropic 对受限地区/机房 IP 会返回封锁页（含 "unavailable" 等标识）或非预期状态码
 *  - API 端点：未授权时正常返回 401（说明网络可达且未被地区封锁），返回 403 + 封锁内容则不可用
 *  - 网页端：正常返回 200/403(Cloudflare challenge)，返回封锁页则不可用
 */

const POLICY = (typeof $argument !== "undefined" && $argument)
  ? Object.fromEntries($argument.split("&").map(kv => kv.split("="))).policy || "Claude"
  : "Claude";

const TESTS = [
  { name: "API",     url: "https://api.anthropic.com/v1/messages" },
  { name: "claude.ai", url: "https://claude.ai/" },
];

const ICON_OK   = "checkmark.circle.fill";
const ICON_FAIL = "xmark.circle.fill";
const ICON_WARN = "exclamationmark.triangle.fill";
const COLOR_OK   = "#34C759";
const COLOR_FAIL = "#FF3B30";
const COLOR_WARN = "#FF9500";

function request(test) {
  return new Promise(resolve => {
    const opts = {
      url: test.url,
      timeout: 8,
      "policy-descriptor": POLICY,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15"
      }
    };
    // API 端点用 POST 触发 401，网页端用 GET
    const method = test.name === "API" ? "post" : "get";
    if (method === "post") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify({ model: "claude-3-haiku", messages: [], max_tokens: 1 });
    }
    $httpClient[method](opts, (err, resp, data) => {
      if (err) { resolve({ name: test.name, ok: false, detail: "超时/不可达" }); return; }
      const status = resp.status;
      const body = (data || "").toLowerCase();
      const blocked = body.includes("unavailable") ||
                      body.includes("not available") ||
                      body.includes("restricted") ||
                      body.includes("blocked");
      let ok = false, detail = `HTTP ${status}`;
      if (test.name === "API") {
        // 401 = 网络通且未被地区封锁（只是没带 key），算可用
        ok = (status === 401 || status === 400) && !blocked;
        if (status === 403 || blocked) detail = "地区受限";
      } else {
        // 网页端 200 或 Cloudflare 403 challenge 都算通，封锁页不算
        ok = (status === 200 || status === 403) && !blocked;
        if (blocked) detail = "地区受限";
      }
      resolve({ name: test.name, ok, detail });
    });
  });
}

(async () => {
  const results = await Promise.all(TESTS.map(request));
  const allOk = results.every(r => r.ok);
  const noneOk = results.every(r => !r.ok);

  const title = "Claude 可用性";
  const content = results.map(r => `${r.name}: ${r.ok ? "✓ 可用" : "✗ " + r.detail}`).join("\n");

  let icon, color;
  if (allOk)      { icon = ICON_OK;   color = COLOR_OK; }
  else if (noneOk){ icon = ICON_FAIL; color = COLOR_FAIL; }
  else            { icon = ICON_WARN; color = COLOR_WARN; }

  $done({ title, content, icon, "icon-color": color });
})();
