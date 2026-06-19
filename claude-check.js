/*
 * Claude 可用性检测面板（增强版）
 * 请求 claude.ai 的 Cloudflare trace 接口，一次拿全：
 *   - 可用性（出口国家 vs Anthropic 支持地区白名单）
 *   - 出口 IP
 *   - colo（Cloudflare 数据中心机房代码）
 *   - 协议（http/h2/h3）
 *   - 实时延迟（请求往返耗时）
 * 走 Surge 规则分流，claude.ai 命中 Claude 组出口。
 *
 * 可选 argument：
 *   icon / iconerr / icon-color / iconerr-color / title
 */

let url = "http://claude.ai/cdn-cgi/trace";

// Anthropic 支持的国家/地区白名单（ISO 3166-1 alpha-2）
let supported = ["US","CA","GB","IE","AU","NZ","JP","KR","SG","TW","IN","ID","MY","TH","PH","VN",
"AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IT","LV","LI","LT","LU",
"MT","NL","NO","PL","PT","RO","SK","SI","ES","SE","CH","UA","IL","AE","QA","KW","BH","OM","SA",
"ZA","NG","KE","GH","MX","BR","AR","CL","CO","PE","UY","EC","CR","PA","DO","JM","BS","BB","BZ",
"FJ","PG","BD","LK","NP","MN","KZ","GE","AM","AZ","MD","BA","MK","ME","RS","AL"];

// 解析 argument
let titlediy, icon, iconerr, iconColor, iconerrColor;
if (typeof $argument !== 'undefined') {
  $argument.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k === 'title') titlediy = v;
    else if (k === 'icon') icon = v;
    else if (k === 'iconerr') iconerr = v;
    else if (k === 'icon-color') iconColor = v;
    else if (k === 'iconerr-color') iconerrColor = v;
  });
}

// 协议代码美化
function protoName(h) {
  if (!h) return '?';
  if (h === 'h3') return 'HTTP/3';
  if (h === 'h2') return 'HTTP/2';
  if (h.indexOf('1.1') !== -1) return 'HTTP/1.1';
  return h;
}

let startTime = Date.now();

$httpClient.get(url, function(error, response, data){
  let latency = Date.now() - startTime;

  if (error) {
    console.log("Claude trace 请求失败: " + error);
    $done({
      title: titlediy || 'Claude 可用性',
      content: '✖️ 连接失败 / 超时',
      icon: iconerr || 'xmark.seal.fill',
      'icon-color': iconerrColor || '#D65C51'
    });
    return;
  }

  // 解析 trace（key=value 逐行）
  let cf = {};
  (data || "").split("\n").forEach(line => {
    let idx = line.indexOf("=");
    if (idx > 0) cf[line.slice(0, idx)] = line.slice(idx + 1);
  });

  let loc   = cf.loc || "??";
  let ip    = cf.ip || "未知";
  let colo  = cf.colo || "??";
  let proto = protoName(cf.http);
  let flag  = getFlag(loc);
  let ok    = supported.indexOf(loc) !== -1;

  console.log(`Claude trace: loc=${loc} ip=${ip} colo=${colo} http=${cf.http} 延迟=${latency}ms 支持=${ok}`);

  // 组装多行内容
  let line1 = ok ? `✔️ 可用` : `✖️ 区域受限`;
  let content =
    `${line1}　${flag}${loc}　${latency}ms\n` +
    `IP: ${ip}\n` +
    `机房: ${colo}　协议: ${proto}`;

  $done({
    title: titlediy || 'Claude 可用性',
    content: content,
    icon: ok ? (icon || 'checkmark.seal.fill') : (iconerr || 'xmark.seal.fill'),
    'icon-color': ok ? (iconColor || '#D97757') : (iconerrColor || '#D65C51')
  });
});

function getFlag(cc){
  if (!cc || cc.length !== 2) return '';
  if (cc.toUpperCase() === 'TW') cc = 'CN';
  return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
}
