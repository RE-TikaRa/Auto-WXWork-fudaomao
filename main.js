"auto";
auto.waitFor();

// 验证无障碍服务是否正常工作
try {
    selector().exists();
    console.log("[服务] 无障碍服务正常");
} catch (e) {
    toast("无障碍服务异常，请重新开启");
    console.error("[服务] 无障碍服务异常: " + e);
    exit();
}

// 关闭上次运行遗留的弹窗（仅限本脚本的 alert 弹窗）
function dismissOwnDialogs() {
    var titles = ["签到完成", "签到失败", "签到结果"];
    var dismissed = 0;
    for (var round = 0; round < 5; round++) {
        var found = false;
        try {
            var pkg = currentPackage();
            if (pkg !== "org.autojs.autojs6") break;

            for (var i = 0; i < titles.length; i++) {
                if (text(titles[i]).exists()) {
                    var okBtn = text("确定").findOnce();
                    if (okBtn && okBtn.clickable()) {
                        console.log(">>> 关闭遗留弹窗: " + titles[i]);
                        okBtn.click();
                        sleep(500);
                        dismissed++;
                        found = true;
                    }
                    break;
                }
            }
        } catch (e) {}
        if (!found) break;
    }
    return dismissed;
}
dismissOwnDialogs();

// ============================================================================
// 前台服务通知 - 防止 Android 系统杀死脚本
// ============================================================================
//
// 【问题背景】
// Android 7.0+ 系统会积极回收后台进程以节省电量和内存。
// 即使脚本有 setInterval 和 events.observeNotification() 保持运行，
// 系统仍可能在以下情况下终止 AutoJs6 进程：
//   1. 电池优化 - 系统判定 AutoJs6 为"不活跃"应用
//   2. 内存压力 - 系统需要释放内存给前台应用
//   3. 省电模式 - 更激进地杀死后台进程
//   4. 厂商定制 - 部分手机厂商有额外的后台限制
//
// 【解决方案】
// 通过发送一个常驻通知（ongoing notification），让系统认为脚本有活跃的
// 前台任务正在运行，从而大幅降低被系统杀死的概率。
// 这是 Android 官方推荐的后台服务保活方式。
//
// 【注意事项】
// 此方案不能 100% 保证脚本不被杀死，还需要配合以下手动设置：
//   - 关闭 AutoJs6 的电池优化（设置 → 电池 → AutoJs6 → 无限制）
//   - 在最近任务中锁定 AutoJs6
//   - 开启 AutoJs6 的自启动权限（部分手机需要）
//   - 关闭省电模式
// ============================================================================

// 前台服务通知 ID
var NOTIFICATION_ID = 10086;
var RESULT_NOTIFICATION_ID = 10087;

function refreshNotification() {
    try {
        notice({
            title: "辅导猫自动签到",
            content: "签到服务运行中",
            notificationId: NOTIFICATION_ID,
            isSilent: true,
            autoCancel: false,
        });
        return true;
    } catch (e) {
        console.warn("[服务] 无法创建前台通知: " + e);
        return false;
    }
}

// 尝试创建前台服务通知
if (refreshNotification()) {
    console.log("[服务] 前台通知已创建");
}

events.on("exit", function () {
    try {
        notice.cancel(NOTIFICATION_ID);
    } catch (e) {}
});

// ============================================================================
// 签到配置
// ============================================================================
//
// 【配置说明】
// 修改以下配置以适应你的实际情况。
// 大部分用户只需要修改 reasonText（签到原因）和时间相关配置。
// ============================================================================

var CONFIG = {
    // -------------------------------------------------------------------------
    // 应用配置
    // -------------------------------------------------------------------------

    // 企业微信包名 - 用于启动应用和强制停止
    // 一般无需修改，除非你使用的是特殊版本的企业微信
    packageName: "com.tencent.wework",

    // 范围外签到时填写的原因
    // 当你不在签到范围内时，系统会要求填写原因，这里自动填入此文本
    reasonText: "离校",

    // 企业微信工作台中辅导猫入口的文本
    // 脚本通过查找包含此文本的控件来定位辅导猫入口
    // 如果你的辅导猫显示名称不同，请修改此值
    entryText: "辅导猫",

    // -------------------------------------------------------------------------
    // 通知触发配置
    // -------------------------------------------------------------------------

    // 触发关键词列表
    // 当企业微信通知的标题或内容包含以下任一关键词时，触发签到
    // 可以根据实际收到的通知内容添加或修改关键词
    keywords: ["打卡", "签到", "辅导猫"],

    // 通知触发生效时段 - 开始时间
    // 只有在此时段内收到的通知才会触发签到
    // 避免在非签到时间被无关通知误触发
    startHour: 7, // 小时（24小时制）
    startMinute: 50, // 分钟

    // 通知触发生效时段 - 结束时间
    endHour: 8, // 小时（24小时制）
    endMinute: 10, // 分钟

    // -------------------------------------------------------------------------
    // 备用定时配置
    // -------------------------------------------------------------------------

    // 备用定时签到时间列表（24小时制）
    // 格式：["HH:mm", "HH:mm"]
    fallbackTimes: ["10:30", "12:00", "18:00"],
};

// ============================================================================
// 运行时常量
// ============================================================================
//
// 【常量说明】
// 这些常量控制脚本的运行行为，一般无需修改。
// 如果遇到特定问题（如页面加载慢），可以适当调整。
// ============================================================================

// 轮询间隔（毫秒）
// waitFor 函数在等待元素出现时，每隔此时间检查一次
// 值越小响应越快，但 CPU 占用越高
// 推荐范围：100-500ms
var POLL_INTERVAL = 200;

// 单次等待超时（毫秒）
// waitFor 函数等待单个元素的最长时间
// 如果超过此时间元素仍未出现，返回 null
// 推荐范围：5000-15000ms
var MAX_WAIT = 10000;

// 动画延迟（毫秒）
// 在点击按钮前等待的时间，确保页面动画完成
// 如果点击经常失败，可以适当增加此值
// 推荐范围：300-1000ms
var ANIM_DELAY = 500;

// 全局超时（毫秒）
// 整个签到流程的最长执行时间
// 超过此时间强制退出，防止脚本卡死
// 当前设置：180000ms = 3分钟
var GLOBAL_TIMEOUT = 180000;

// ============================================================================
// 运行时状态变量
// ============================================================================
//
// 【状态说明】
// 这些变量用于跟踪脚本的运行状态，防止重复触发和记录每日签到情况。
// ============================================================================

// 运行锁 - 防止签到流程并发执行
// 当签到流程正在运行时为 true，此时忽略新的触发请求
// 避免多个通知同时触发导致的混乱
var isRunning = false;

// 今日已触发标记 - 记录今天是否已成功签到
// 签到成功后设为 true，防止重复签到
// 注意：只有签到成功才会设置，失败不会阻止后续尝试
var todayTriggered = false;

// 备用定时重试计数 - 每个时间点失败后最多重试 3 次
var MAX_FALLBACK_ATTEMPTS = 3;
var fallbackStates = {};

// 上次检查的日期 - 用于检测日期变化
// 格式："年-月-日"，如 "2024-1-15"
// 当日期变化时，重置 todayTriggered 和 fallbackStates
var lastCheckedDate = "";

var FALLBACK_TIMES = parseFallbackTimes(CONFIG.fallbackTimes);

// ============================================================================
// 工具函数 - 时间和日期
// ============================================================================

function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function parseFallbackTimes(timeList) {
    var normalized = [];
    var seen = {};
    for (var i = 0; i < timeList.length; i++) {
        var raw = (timeList[i] || "").trim();
        var match = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (!match) continue;
        var h = parseInt(match[1], 10);
        var m = parseInt(match[2], 10);
        if (h < 0 || h > 23 || m < 0 || m > 59) continue;
        var key = formatTime(h, m);
        if (seen[key]) continue;
        seen[key] = true;
        normalized.push({ time: key, minutes: h * 60 + m });
    }
    normalized.sort(function (a, b) {
        return a.minutes - b.minutes;
    });
    return normalized;
}

function resetFallbackStates() {
    fallbackStates = {};
    for (var i = 0; i < FALLBACK_TIMES.length; i++) {
        fallbackStates[FALLBACK_TIMES[i].time] = {
            attempts: 0,
            lastAttemptTs: 0,
            finished: false,
        };
    }
}

function resetDailyFlag() {
    var today = getTodayStr();
    if (lastCheckedDate !== today) {
        todayTriggered = false;
        resetFallbackStates();
        lastCheckedDate = today;
        console.log("[日期变更] 重置每日触发标记");
    }
}

function isInTimeRange() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var current = h * 60 + m;
    var start = CONFIG.startHour * 60 + CONFIG.startMinute;
    var end = CONFIG.endHour * 60 + CONFIG.endMinute;
    return current >= start && current <= end;
}

function formatTime(h, m) {
    return h.toString().padStart(2, "0") + ":" + m.toString().padStart(2, "0");
}

function getFallbackCandidate(nowTs) {
    var now = new Date(nowTs);
    var nowMinutes = now.getHours() * 60 + now.getMinutes();
    for (var i = 0; i < FALLBACK_TIMES.length; i++) {
        var item = FALLBACK_TIMES[i];
        if (nowMinutes < item.minutes) continue;
        var state = fallbackStates[item.time];
        if (!state || state.finished) continue;
        if (state.attempts >= MAX_FALLBACK_ATTEMPTS) {
            state.finished = true;
            continue;
        }
        if (state.lastAttemptTs > 0 && nowTs - state.lastAttemptTs < 30000)
            continue;
        return item;
    }
    return null;
}

function sendResultNotification(content) {
    try {
        notice({
            title: "辅导猫签到结果",
            content: content,
            notificationId: RESULT_NOTIFICATION_ID,
            isSilent: false,
            autoCancel: true,
        });
    } catch (e) {
        console.warn("[通知] 结果通知发送失败: " + e);
    }
}

function saveCheckinLog(reason, startedAt, endedAt, summary, results) {
    try {
        var datePart =
            startedAt.getFullYear() +
            "-" +
            (startedAt.getMonth() + 1).toString().padStart(2, "0") +
            "-" +
            startedAt.getDate().toString().padStart(2, "0");
        var logDir = files.path("./logs");
        var logPath = files.join(logDir, "checkin-" + datePart + ".log");
        files.ensureDir(logPath);
        var lines = [];
        lines.push("==== 辅导猫签到日志 ====");
        lines.push("触发来源: " + reason);
        lines.push("开始时间: " + startedAt.toLocaleString());
        lines.push("结束时间: " + endedAt.toLocaleString());
        lines.push("汇总: " + summary.replace(/\n/g, " | "));
        if (results && results.length > 0) {
            lines.push("活动结果:");
            for (var i = 0; i < results.length; i++) {
                var item = results[i];
                var deadline = item.deadline
                    ? " (截止:" + item.deadline + ")"
                    : "";
                lines.push(
                    "  - " + item.name + deadline + " -> " + item.result,
                );
            }
        }
        files.append(logPath, lines.join("\n") + "\n\n");
    } catch (e) {
        console.warn("[日志] 写入失败: " + e);
    }
}

// ============================================================================
// 工具函数 - 设备操作
// ============================================================================

function wakeUp() {
    if (device.isScreenOn()) return true;
    console.log(">>> 唤醒屏幕...");
    device.wakeUp();
    sleep(500);
    if (!device.isScreenOn()) {
        console.log(">>> 唤醒失败");
        return false;
    }
    console.log(">>> 上滑...");
    swipe(
        device.width / 2,
        device.height * 0.8,
        device.width / 2,
        device.height * 0.3,
        300,
    );
    sleep(500);
    return true;
}

// ============================================================================
// 工具函数 - UI 等待和点击
// ============================================================================

function waitFor(finder, timeout, globalStart) {
    timeout = timeout || MAX_WAIT;
    var start = Date.now();
    while (Date.now() - start < timeout) {
        if (globalStart && Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时");
            return null;
        }
        var result = finder();
        if (result) return result;
        sleep(POLL_INTERVAL);
    }
    return null;
}

function smartClick(widget) {
    if (!widget) return false;
    if (widget.clickable()) return widget.click();
    var p = widget.parent();
    if (p && p.clickable()) return p.click();
    var b = widget.bounds();
    return click(b.centerX(), b.centerY());
}

function debugPage(tag) {
    console.log("\n========== [DEBUG] " + tag + " ==========");

    try {
        console.log("包名: " + currentPackage());
        console.log("Activity: " + currentActivity());
    } catch (e) {
        console.log("包名/Activity: (远程模式不可用)");
    }

    var keywords = [
        "已签到",
        "未签到",
        "签到",
        "范围外签到",
        "继续签到",
        "去拍照",
        "完成签到",
        "已结束",
    ];
    console.log("\n[关键词检测]");
    keywords.forEach(function (kw) {
        var found = textContains(kw).find();
        if (found.length > 0) {
            console.log('  ✓ "' + kw + '" 找到 ' + found.length + " 个");
            found.forEach(function (w, i) {
                var b = w.bounds();
                console.log(
                    "    [" +
                        i +
                        "] center:(" +
                        b.centerX() +
                        "," +
                        b.centerY() +
                        ") clickable:" +
                        w.clickable() +
                        ' text:"' +
                        w.text() +
                        '"',
                );
            });
        }
    });

    console.log("\n[可点击控件 Y<" + Math.floor(device.height * 0.7) + "]");
    var clickables = selector().clickable(true).find();
    var count = 0;
    clickables.forEach(function (w) {
        var b = w.bounds();
        if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
            count++;
            var t = w.text() || w.desc() || "(无文本)";
            console.log(
                "  #" +
                    count +
                    ' "' +
                    t +
                    '" center:(' +
                    b.centerX() +
                    "," +
                    b.centerY() +
                    ") class:" +
                    w.className(),
            );
        }
    });
    console.log("========== [/DEBUG] ==========\n");
}

// ============================================================================
// 签到核心逻辑
// ============================================================================

function doCheckin(globalStart) {
    // -------------------------------------------------------------------------
    // 步骤 1: 等待页面加载，查找签到按钮
    // -------------------------------------------------------------------------
    // 只查找签到按钮，不在轮询中检测过期状态
    // 过期检测放到超时后，避免页面加载过程中误判
    // -------------------------------------------------------------------------
    var pageState = waitFor(
        function () {
            // 优先查找"范围外签到"按钮
            var btn = text("范围外签到").findOnce();
            if (btn) {
                var b = btn.bounds();
                var cls = btn.className();
                if (
                    cls.indexOf("WebView") < 0 &&
                    b.centerY() < device.height * 0.8
                ) {
                    return { btn: btn };
                }
            }

            // 查找普通"签到"按钮
            var candidates = text("签到").find();
            for (var i = 0; i < candidates.length; i++) {
                var cls = candidates[i].className();
                if (cls.indexOf("WebView") >= 0) continue;
                var b = candidates[i].bounds();
                if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
                    return { btn: candidates[i] };
                }
            }

            // 检查是否已签到（这个可以提前返回）
            if (textContains("已签到").exists()) return "already_signed";

            return null;
        },
        MAX_WAIT,
        globalStart,
    );

    // 处理检测结果
    if (pageState === "already_signed") {
        console.log(">>> 已签到，跳过");
        return "already_signed";
    }

    // 未找到签到按钮时，检查是否过期
    if (!pageState || !pageState.btn) {
        if (text("已结束").exists()) {
            console.log(">>> 活动已结束");
            return "missed";
        }
        // 显示"未签到"但没有签到按钮 = 已过期未签到
        if (textContains("未签到").exists()) {
            console.log(">>> 已过期未签到（无签到按钮）");
            return "missed";
        }
        console.log(">>> 未找到签到按钮");
        return "no_button";
    }

    // -------------------------------------------------------------------------
    // 步骤 2: 点击签到按钮
    // -------------------------------------------------------------------------
    sleep(ANIM_DELAY);
    console.log(">>> 点击: " + pageState.btn.text());
    smartClick(pageState.btn);

    // -------------------------------------------------------------------------
    // 步骤 3: 处理"继续签到"弹窗（可选）
    // -------------------------------------------------------------------------
    var continueBtn = waitFor(
        function () {
            return text("继续签到").findOnce();
        },
        5000,
        globalStart,
    );
    if (continueBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 继续签到");
        smartClick(continueBtn);
    }

    // -------------------------------------------------------------------------
    // 步骤 3.5: 处理"未签到"状态
    // -------------------------------------------------------------------------
    // 注意："为何不能签到？"是页面上的固定链接，不能作为过期判断依据
    // -------------------------------------------------------------------------
    if (textContains("未签到").exists()) {
        // 查找底部区域的签到按钮（80% < Y < 95%，排除导航栏）
        var bottomSignBtn = null;
        var signBtns = text("签到").find();
        for (var i = 0; i < signBtns.length; i++) {
            var b = signBtns[i].bounds();
            var cls = signBtns[i].className();
            // 排除 WebView 容器和底部导航栏（Y > 95%）
            if (cls.indexOf("WebView") >= 0) continue;
            if (
                b.centerY() > device.height * 0.8 &&
                b.centerY() < device.height * 0.95
            ) {
                bottomSignBtn = signBtns[i];
                break;
            }
        }

        if (!bottomSignBtn) {
            var outRangeBtn = text("范围外签到").findOnce();
            if (outRangeBtn) {
                var b = outRangeBtn.bounds();
                var cls = outRangeBtn.className();
                if (
                    cls.indexOf("WebView") < 0 &&
                    b.centerY() > device.height * 0.8 &&
                    b.centerY() < device.height * 0.95
                ) {
                    bottomSignBtn = outRangeBtn;
                }
            }
        }

        if (!bottomSignBtn) {
            console.log(">>> 显示未签到但无签到按钮，时间已过期");
            return "missed";
        }

        console.log(">>> 点击底部签到按钮");
        sleep(ANIM_DELAY);
        click(
            bottomSignBtn.bounds().centerX(),
            bottomSignBtn.bounds().centerY(),
        );
    }

    // -------------------------------------------------------------------------
    // 步骤 4: 处理拍照流程（如果需要）
    // -------------------------------------------------------------------------
    var photoBtn = waitFor(
        function () {
            return text("去拍照").findOnce();
        },
        5000,
        globalStart,
    );
    if (photoBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 去拍照");
        smartClick(photoBtn);

        // 4a. 处理相机权限弹窗
        // 不同系统的权限按钮文本可能不同，需要匹配多种情况
        var permissionBtn = waitFor(
            function () {
                return (
                    text("允许").findOnce() ||
                    text("始终允许").findOnce() ||
                    textContains("仅在使用").findOnce()
                );
            },
            2000,
            globalStart,
        );
        if (permissionBtn) {
            console.log(">>> 处理权限弹窗");
            smartClick(permissionBtn);
            sleep(500);
        }

        // 4b. 点击快门按钮
        // 通过尺寸和位置识别快门按钮（屏幕中央的圆形按钮）
        var shutterBtn = waitFor(
            function () {
                var minSize = device.width * 0.1; // 最小尺寸：屏幕宽度的 10%
                var maxSize = device.width * 0.2; // 最大尺寸：屏幕宽度的 20%
                return className("android.widget.ImageView")
                    .filter(function (w) {
                        var b = w.bounds();
                        // 条件：尺寸在范围内，且水平位置接近屏幕中央
                        return (
                            b.width() >= minSize &&
                            b.width() <= maxSize &&
                            Math.abs(b.centerX() - device.width / 2) < 50
                        );
                    })
                    .findOnce();
            },
            5000,
            globalStart,
        );
        if (shutterBtn) {
            sleep(ANIM_DELAY);
            var b = shutterBtn.bounds();
            console.log(
                ">>> 点击快门: (" + b.centerX() + ", " + b.centerY() + ")",
            );
            click(b.centerX(), b.centerY());
        }

        // 4c. 点击"使用照片"
        var usePhotoBtn = waitFor(
            function () {
                return text("使用照片").findOnce();
            },
            5000,
            globalStart,
        );
        if (usePhotoBtn) {
            sleep(ANIM_DELAY);
            console.log(">>> 点击: 使用照片");
            smartClick(usePhotoBtn);
        }

        // 4d. 填写签到原因
        var inputBox = waitFor(
            function () {
                return className("EditText").findOnce();
            },
            5000,
            globalStart,
        );
        if (inputBox) {
            sleep(ANIM_DELAY);
            console.log(">>> 填写: " + CONFIG.reasonText);
            smartClick(inputBox); // 先点击输入框获取焦点
            sleep(300);
            inputBox.setText(CONFIG.reasonText); // 设置文本
            sleep(300);
            back(); // 收起键盘，否则可能遮挡"完成签到"按钮
        }

        // 4e. 点击"完成签到"
        var finalBtn = waitFor(
            function () {
                return textContains("完成签到").findOnce();
            },
            3000,
            globalStart,
        );
        if (finalBtn) {
            sleep(ANIM_DELAY);
            var b = finalBtn.bounds();
            console.log(
                ">>> 点击完成签到: (" + b.centerX() + ", " + b.centerY() + ")",
            );
            click(b.centerX(), b.centerY());
        }
    }

    // -------------------------------------------------------------------------
    // 步骤 5: 验证签到结果
    // -------------------------------------------------------------------------
    if (
        waitFor(
            function () {
                return textContains("已签到").exists() ? true : null;
            },
            5000,
            globalStart,
        )
    ) {
        console.log(">>> 签到成功！");
        return "success";
    }
    return "unknown";
}

// ============================================================================
// 签到流程控制
// ============================================================================

function runCheckinFlow(triggerReason) {
    // 记录流程开始时间，用于全局超时控制
    var globalStart = Date.now();
    var startedAt = new Date();
    var reason = triggerReason || "未知触发";

    function finishFlow(hasSuccess, summary, results) {
        sendResultNotification(summary.split("\n").slice(0, 4).join(" | "));
        saveCheckinLog(reason, startedAt, new Date(), summary, results || []);
        return hasSuccess;
    }

    console.log("\n===== 开始签到流程 =====");

    // -------------------------------------------------------------------------
    // 步骤 1: 唤醒屏幕
    // -------------------------------------------------------------------------
    if (!wakeUp()) {
        console.error(">>> 唤醒失败");
        return finishFlow(
            false,
            "成功: 0\n已签到: 0\n错过签到: 0\n失败: 1\n\n失败活动:\n唤醒屏幕失败",
            [],
        );
    }

    // -------------------------------------------------------------------------
    // 步骤 2-3: 杀掉企业微信后台并启动（最多重试3次）
    // -------------------------------------------------------------------------
    var MAX_LAUNCH_RETRIES = 3;
    var appLaunched = false;

    for (var retry = 1; retry <= MAX_LAUNCH_RETRIES; retry++) {
        console.log(
            ">>> 尝试启动企业微信 (" + retry + "/" + MAX_LAUNCH_RETRIES + ")",
        );

        // 杀掉后台
        console.log(">>> 杀掉企业微信后台...");
        app.openAppSetting(CONFIG.packageName);
        var forceStopBtn = waitFor(
            function () {
                return (
                    text("强行停止").findOnce() || text("结束运行").findOnce()
                );
            },
            3000,
            globalStart,
        );

        if (forceStopBtn) {
            console.log(
                ">>> 找到停止按钮: " +
                    forceStopBtn.text() +
                    ", clickable=" +
                    forceStopBtn.clickable(),
            );
            if (forceStopBtn.clickable()) {
                forceStopBtn.click();
                sleep(300);
                var confirmBtn = waitFor(
                    function () {
                        return text("确定").findOnce();
                    },
                    2000,
                    globalStart,
                );
                if (confirmBtn) {
                    console.log(">>> 点击确定");
                    confirmBtn.click();
                    sleep(500);
                }
            } else {
                console.log(">>> 停止按钮不可点击（应用可能已停止）");
            }
        } else {
            console.log(">>> 未找到停止按钮");
        }

        home();
        sleep(500);

        // 启动企业微信
        console.log(">>> 启动企业微信...");
        app.launch(CONFIG.packageName);
        sleep(3000);

        // 检测是否成功启动（超时30秒）
        appLaunched = waitFor(
            function () {
                return (
                    textContains(CONFIG.entryText).exists() ||
                    textContains("工作台").exists()
                );
            },
            30000,
            globalStart,
        );

        if (appLaunched) {
            console.log(">>> 企业微信启动成功");

            // 确保回到消息页（点击底部"消息"tab）
            var msgTab = text("消息")
                .boundsInside(
                    0,
                    device.height * 0.9,
                    device.width,
                    device.height,
                )
                .findOnce();
            if (msgTab) {
                console.log(">>> 点击消息tab确保在首页");
                click(msgTab.bounds().centerX(), msgTab.bounds().centerY());
                sleep(500);
            }
            break;
        }

        console.warn(">>> 启动超时，准备重试...");
    }

    if (!appLaunched) {
        console.error(
            ">>> 企业微信启动失败，已重试 " + MAX_LAUNCH_RETRIES + " 次",
        );
        debugPage("企业微信启动失败");
        toast("企业微信启动失败");
        alert("签到失败", "企业微信启动超时，请检查应用状态");
        return finishFlow(
            false,
            "成功: 0\n已签到: 0\n错过签到: 0\n失败: 1\n\n失败活动:\n企业微信启动超时",
            [],
        );
    }

    // -------------------------------------------------------------------------
    // 步骤 4: 进入辅导猫（带重试）
    // -------------------------------------------------------------------------
    var MAX_PAGE_RETRIES = 2;
    var activities = null;
    var today = new Date();
    var todayStr =
        (today.getMonth() + 1).toString().padStart(2, "0") +
        "月" +
        today.getDate().toString().padStart(2, "0") +
        "日";
    console.log(">>> 今天: " + todayStr);

    for (var pageRetry = 1; pageRetry <= MAX_PAGE_RETRIES; pageRetry++) {
        var fudaomao = waitFor(
            function () {
                return textContains(CONFIG.entryText).findOnce();
            },
            10000,
            globalStart,
        );
        if (!fudaomao) {
            console.error(">>> 未找到辅导猫入口");
            debugPage("未找到辅导猫入口");
            return finishFlow(
                false,
                "成功: 0\n已签到: 0\n错过签到: 0\n失败: 1\n\n失败活动:\n未找到辅导猫入口",
                [],
            );
        }
        console.log(
            ">>> 点击: 辅导猫 (尝试 " +
                pageRetry +
                "/" +
                MAX_PAGE_RETRIES +
                ")",
        );
        smartClick(fudaomao);

        sleep(2000);
        activities = textContains(todayStr).find();
        console.log(">>> 找到 " + activities.length + " 个今日活动");

        if (activities.length > 0) break;

        if (pageRetry < MAX_PAGE_RETRIES) {
            console.log(">>> 页面加载失败，返回重试...");
            back();
            sleep(1000);
        }
    }

    if (!activities || activities.length === 0) {
        console.log(">>> 没有今日活动");
        debugPage("没有今日活动");
        toast("没有今日活动");
        alert("签到完成", "今日没有需要签到的活动");
        return finishFlow(
            false,
            "成功: 0\n已签到: 0\n错过签到: 0\n失败: 0",
            [],
        );
    }

    // -------------------------------------------------------------------------
    // 步骤 5: 预扫描生成待签到列表（解析并标记截止时间）
    // -------------------------------------------------------------------------
    var todoList = [];
    var now = new Date();
    console.log(">>> 当前时间: " + now.toLocaleString());

    for (var i = 0; i < activities.length; i++) {
        var act = activities[i];
        var fullText = act.text() || "";
        var b = act.bounds();

        // 解析活动名称（第一行）和截止时间
        var lines = fullText.split("\n");
        var activityName = lines[0] || "";

        // 解析截止时间（格式：签到截止时间：2026年02月21日 22:00）
        var deadlineMatch = fullText.match(
            /签到截止时间[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/,
        );
        var isExpired = false;
        var deadlineStr = "";

        if (deadlineMatch) {
            var year = parseInt(deadlineMatch[1]);
            var month = parseInt(deadlineMatch[2]) - 1;
            var day = parseInt(deadlineMatch[3]);
            var hour = parseInt(deadlineMatch[4]);
            var minute = parseInt(deadlineMatch[5]);
            var deadline = new Date(year, month, day, hour, minute);
            deadlineStr =
                month +
                1 +
                "/" +
                day +
                " " +
                hour +
                ":" +
                (minute < 10 ? "0" + minute : minute);
            isExpired = now > deadline;
        }

        todoList.push({
            name: activityName,
            fullText: fullText.substring(0, 50),
            centerY: b.centerY(),
            isExpired: isExpired,
            deadlineStr: deadlineStr,
        });
    }

    console.log("\n===== 待签到列表 =====");
    var validCount = 0;
    todoList.forEach(function (item, idx) {
        var status = item.isExpired ? "[已过期]" : "[待处理]";
        if (!item.isExpired) validCount++;
        var deadline = item.deadlineStr
            ? " (截止:" + item.deadlineStr + ")"
            : "";
        console.log(idx + 1 + ". " + status + " " + item.name + deadline);
    });
    console.log("有效活动: " + validCount + "/" + todoList.length);
    console.log("======================\n");

    // -------------------------------------------------------------------------
    // 步骤 6: 按列表顺序处理每个活动
    // -------------------------------------------------------------------------
    var results = [];
    var processedNames = {}; // 已处理的活动名称集合
    var hasSuccess = false;

    for (var todoIdx = 0; todoIdx < todoList.length; todoIdx++) {
        if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时，退出");
            break;
        }

        var todoItem = todoList[todoIdx];

        // 跳过已处理的活动（按名称去重）
        if (processedNames[todoItem.name]) {
            console.log(">>> 跳过已处理: " + todoItem.name);
            continue;
        }
        processedNames[todoItem.name] = true;

        console.log(
            "\n===== 活动 " +
                (todoIdx + 1) +
                "/" +
                todoList.length +
                ": " +
                todoItem.name +
                " =====",
        );
        if (todoItem.isExpired) {
            console.log(
                ">>> 截止时间已过 (" +
                    todoItem.deadlineStr +
                    ")，检查是否已签到...",
            );
        }

        // 重新查找活动（页面可能已刷新）
        var activity = null;
        var currentActivities = textContains(todayStr).find();
        for (var j = 0; j < currentActivities.length; j++) {
            var actName = currentActivities[j].text() || "";
            if (actName.indexOf(todoItem.name.substring(0, 20)) >= 0) {
                activity = currentActivities[j];
                break;
            }
        }

        if (!activity) {
            console.log(">>> 活动已消失，跳过");
            results.push({
                name: todoItem.name,
                deadline: todoItem.deadlineStr,
                result: "not_found",
            });
            continue;
        }

        // 点击进入活动详情
        console.log(">>> 点击活动: Y=" + activity.bounds().centerY());
        smartClick(activity);

        // 执行签到
        var result;
        try {
            result = doCheckin(globalStart);
            if (result === "success") hasSuccess = true;
        } catch (e) {
            console.error("签到异常: " + e);
            result = "error";
        }

        // 失败时分析当前页面
        if (result !== "success" && result !== "already_signed") {
            debugPage("签到失败 - " + result);
        }

        results.push({
            name: todoItem.name,
            deadline: todoItem.deadlineStr,
            result: result,
        });

        // 返回活动列表
        console.log(">>> 返回");
        back();
        sleep(1000);
    }

    // -------------------------------------------------------------------------
    // 步骤 7: 输出结果汇总
    // -------------------------------------------------------------------------
    console.log("\n===== 结果汇总 =====");
    var successCount = 0;
    var failCount = 0;
    var skipCount = 0;
    var missedCount = 0;
    var failedNames = [];
    var missedNames = [];

    results.forEach(function (r, idx) {
        var deadline = r.deadline ? " (截止:" + r.deadline + ")" : "";
        console.log(idx + 1 + ". " + r.name + deadline + " -> " + r.result);
        if (r.result === "success") successCount++;
        else if (r.result === "already_signed") skipCount++;
        else if (r.result === "missed") {
            missedCount++;
            missedNames.push(
                r.name + (r.deadline ? "\n  截止:" + r.deadline : ""),
            );
        } else {
            failCount++;
            failedNames.push(
                r.name + (r.deadline ? "\n  截止:" + r.deadline : ""),
            );
        }
    });
    console.log("===== 签到流程结束 =====\n");

    // 弹窗显示结果
    var summary =
        "成功: " +
        successCount +
        "\n已签到: " +
        skipCount +
        "\n错过签到: " +
        missedCount +
        "\n失败: " +
        failCount;
    if (missedCount > 0) {
        summary += "\n\n错过签到:\n" + missedNames.join("\n");
    }
    if (failCount > 0) {
        summary += "\n\n失败活动:\n" + failedNames.join("\n");
    }

    if (failCount === 0 && missedCount === 0) {
        toast("签到完成！");
        alert("签到完成", summary);
    } else {
        toast("签到有异常，请检查");
        alert("签到结果", summary);
    }

    return finishFlow(hasSuccess, summary, results);
}

function triggerCheckin(reason) {
    // 检查运行锁
    if (isRunning) {
        console.log("[忽略] 签到流程正在运行中");
        return false;
    }

    console.log("\n[" + reason + "] " + new Date().toLocaleString());

    // 获取运行锁
    isRunning = true;

    var success = false;
    try {
        success = runCheckinFlow(reason);
        // 只有成功才标记今日已触发
        if (success) todayTriggered = true;
    } catch (e) {
        console.error("签到流程异常: " + e);
    }

    // 释放运行锁
    isRunning = false;
    console.log(">>> 签到流程锁已释放");
    return success;
}

// ============================================================================
// 服务启动 - 输出配置信息
// ============================================================================

console.log("===== 辅导猫自动签到服务 =====");
console.log("监听包名: " + CONFIG.packageName);
console.log("触发关键词: " + CONFIG.keywords.join(", "));
console.log(
    "通知触发时段: " +
        formatTime(CONFIG.startHour, CONFIG.startMinute) +
        " - " +
        formatTime(CONFIG.endHour, CONFIG.endMinute),
);
console.log(
    "备用定时: " +
        FALLBACK_TIMES.map(function (item) {
            return item.time;
        }).join(", ") +
        " (如通知未触发)",
);
console.log("");

resetDailyFlag();

// ============================================================================
// 通知监听
// ============================================================================
//
// 【工作原理】
// 1. events.observeNotification() 启动通知监听服务
// 2. 当任何应用发出通知时，触发 "notification" 事件
// 3. 在事件处理函数中过滤和处理通知
//
// 【过滤条件】
// 1. 包名必须是企业微信（CONFIG.packageName）
// 2. 当前时间必须在生效时段内（isInTimeRange）
// 3. 通知标题或内容必须包含配置的关键词
//
// 【注意】
// 通知监听依赖于通知访问权限，需要在系统设置中授予 AutoJs6 通知访问权限。
// 如果权限未授予，events.observeNotification() 会抛出异常。
// ============================================================================

events.observeNotification();

events.on("notification", function (notification) {
    // 每次收到通知时检查日期是否变化
    resetDailyFlag();

    // 获取通知信息
    var pkg = notification.getPackageName();
    var title = notification.getTitle() || "";
    var notificationText = notification.getText() || "";

    // 过滤条件 1: 包名必须是企业微信
    if (pkg !== CONFIG.packageName) return;

    // 过滤条件 2: 必须在生效时段内
    if (!isInTimeRange()) {
        console.log("[忽略] 不在生效时段");
        return;
    }

    // 过滤条件 3: 必须匹配关键词
    var content = title + " " + notificationText;
    var matched = CONFIG.keywords.some(function (kw) {
        return content.indexOf(kw) >= 0;
    });

    if (!matched) {
        console.log("[忽略] 不匹配关键词: " + content.substring(0, 30));
        return;
    }

    // 所有条件通过，触发签到（在子线程中执行，避免 UI 线程阻塞）
    console.log("  标题: " + title);
    console.log("  内容: " + notificationText);
    threads.start(function () {
        triggerCheckin("通知触发");
    });
});

// ============================================================================
// 备用定时器
// ============================================================================
//
// 【为什么需要备用定时】
// 通知触发可能因以下原因失败：
// 1. 通知被系统拦截或延迟
// 2. 通知内容不包含配置的关键词
// 3. 收到通知时不在生效时段内
// 4. 网络问题导致通知延迟
//
// 备用定时作为保底方案，在指定时间自动执行签到。
//
// 【触发条件】
// 1. todayTriggered === false（今天还没有成功签到）
// 2. 当前时间 >= 某个备用时间点
// 3. 该时间点重试次数 < MAX_FALLBACK_ATTEMPTS
//
// 【定时器间隔】
// 每 30 秒检查一次。命中备用时间点后按 30 秒间隔重试，
// 每个时间点最多重试 MAX_FALLBACK_ATTEMPTS 次。
// ============================================================================

console.log("监听中... (保持脚本运行)");

setInterval(function () {
    resetDailyFlag();
    refreshNotification();

    if (!todayTriggered) {
        var nowTs = Date.now();
        var candidate = getFallbackCandidate(nowTs);
        if (candidate) {
            var state = fallbackStates[candidate.time];
            state.attempts++;
            state.lastAttemptTs = nowTs;
            console.log(
                "[备用定时 " +
                    candidate.time +
                    "] 尝试 " +
                    state.attempts +
                    "/" +
                    MAX_FALLBACK_ATTEMPTS,
            );
            var success = triggerCheckin("备用定时(" + candidate.time + ")");
            if (success || state.attempts >= MAX_FALLBACK_ATTEMPTS) {
                state.finished = true;
            }
        }
    }
}, 30000);
