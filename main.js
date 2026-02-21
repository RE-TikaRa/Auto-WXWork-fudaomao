"auto";
auto.waitFor();

var CONFIG = {
    packageName: "com.tencent.wework",
    reasonText: "离校",
    entryText: "辅导猫",
    keywords: ["打卡", "签到", "辅导猫"],
    startHour: 7, // 小时（24小时制）
    startMinute: 50, // 分钟
    endHour: 8, // 小时（24小时制）
    endMinute: 10, // 分钟
    fallbackTimes: ["10:30", "12:00", "18:00"],
};

try {
    selector().exists();
    console.log("[服务] 无障碍服务正常");
} catch (e) {
    toast("无障碍服务异常，请重新开启");
    console.error("[服务] 无障碍服务异常: " + e);
    exit();
}

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

var POLL_INTERVAL = 200;
var MAX_WAIT = 10000;
var ANIM_DELAY = 500;
var GLOBAL_TIMEOUT = 180000;
var isRunning = false;
var runningFlag = new java.util.concurrent.atomic.AtomicBoolean(false);
var todayTriggered = false;
var MAX_FALLBACK_ATTEMPTS = 3;
var fallbackStates = {};
var lastCheckedDate = "";
var FALLBACK_TIMES = parseFallbackTimes(CONFIG.fallbackTimes);

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

function doCheckin(globalStart) {
    var pageState = waitFor(
        function () {
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

            var candidates = text("签到").find();
            for (var i = 0; i < candidates.length; i++) {
                var cls = candidates[i].className();
                if (cls.indexOf("WebView") >= 0) continue;
                var b = candidates[i].bounds();
                if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
                    return { btn: candidates[i] };
                }
            }

            if (textContains("已签到").exists()) return "already_signed";

            return null;
        },
        MAX_WAIT,
        globalStart,
    );

    if (pageState === "already_signed") {
        console.log(">>> 已签到，跳过");
        return "already_signed";
    }

    if (!pageState || !pageState.btn) {
        if (text("已结束").exists()) {
            console.log(">>> 活动已结束");
            return "missed";
        }
        if (textContains("未签到").exists()) {
            console.log(">>> 已过期未签到（无签到按钮）");
            return "missed";
        }
        console.log(">>> 未找到签到按钮");
        return "no_button";
    }

    sleep(ANIM_DELAY);
    console.log(">>> 点击: " + pageState.btn.text());
    smartClick(pageState.btn);

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

    // 注意："为何不能签到？"是页面上的固定链接，不能作为过期判断依据
    if (textContains("未签到").exists()) {
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

        var shutterBtn = waitFor(
            function () {
                var minSize = device.width * 0.1; // 最小尺寸：屏幕宽度的 10%
                var maxSize = device.width * 0.2; // 最大尺寸：屏幕宽度的 20%
                return className("android.widget.ImageView")
                    .filter(function (w) {
                        var b = w.bounds();
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

function runCheckinFlow(triggerReason) {
    var globalStart = Date.now();
    var startedAt = new Date();
    var reason = triggerReason || "未知触发";

    function finishFlow(hasSuccess, summary, results) {
        sendResultNotification(summary.split("\n").slice(0, 4).join(" | "));
        saveCheckinLog(reason, startedAt, new Date(), summary, results || []);
        return hasSuccess;
    }

    console.log("\n===== 开始签到流程 =====");

    if (!wakeUp()) {
        console.error(">>> 唤醒失败");
        return finishFlow(
            false,
            "成功: 0\n已签到: 0\n错过签到: 0\n失败: 1\n\n失败活动:\n唤醒屏幕失败",
            [],
        );
    }

    var MAX_LAUNCH_RETRIES = 3;
    var appLaunched = false;

    for (var retry = 1; retry <= MAX_LAUNCH_RETRIES; retry++) {
        console.log(
            ">>> 尝试启动企业微信 (" + retry + "/" + MAX_LAUNCH_RETRIES + ")",
        );

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

        console.log(">>> 启动企业微信...");
        app.launch(CONFIG.packageName);
        sleep(3000);

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
        return finishFlow(
            false,
            "成功: 0\n已签到: 0\n错过签到: 0\n失败: 1\n\n失败活动:\n企业微信启动超时",
            [],
        );
    }

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
        return finishFlow(true, "成功: 0\n已签到: 0\n错过签到: 0\n失败: 0", []);
    }

    var todoList = [];
    var now = new Date();
    console.log(">>> 当前时间: " + now.toLocaleString());

    for (var i = 0; i < activities.length; i++) {
        var act = activities[i];
        var fullText = act.text() || "";
        var b = act.bounds();

        var lines = fullText.split("\n");
        var activityName = lines[0] || "";

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

    var results = [];
    var processedNames = {}; // 已处理的活动名称集合
    var hasSuccess = false;

    for (var todoIdx = 0; todoIdx < todoList.length; todoIdx++) {
        if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时，退出");
            break;
        }

        var todoItem = todoList[todoIdx];

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

        console.log(">>> 点击活动: Y=" + activity.bounds().centerY());
        smartClick(activity);

        var result;
        try {
            result = doCheckin(globalStart);
            if (result === "success") hasSuccess = true;
        } catch (e) {
            console.error("签到异常: " + e);
            result = "error";
        }

        if (result !== "success" && result !== "already_signed") {
            debugPage("签到失败 - " + result);
        }

        results.push({
            name: todoItem.name,
            deadline: todoItem.deadlineStr,
            result: result,
        });

        console.log(">>> 返回");
        back();
        sleep(1000);
    }

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
    } else {
        toast("签到有异常，请检查");
    }

    var dayDone =
        hasSuccess || (failCount === 0 && missedCount === 0 && skipCount > 0);
    return finishFlow(dayDone, summary, results);
}

function triggerCheckin(reason) {
    if (!runningFlag.compareAndSet(false, true)) {
        console.log("[忽略] 签到流程正在运行中");
        return false;
    }

    console.log("\n[" + reason + "] " + new Date().toLocaleString());
    isRunning = true;
    var success = false;
    try {
        success = runCheckinFlow(reason);
        if (success) todayTriggered = true;
    } catch (e) {
        console.error("签到流程异常: " + e);
    } finally {
        isRunning = false;
        runningFlag.set(false);
        console.log(">>> 签到流程锁已释放");
    }
    return success;
}

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
if (FALLBACK_TIMES.length === 0) {
    console.warn("[配置] fallbackTimes 无有效时间，备用定时将不会触发");
}

if (refreshNotification()) {
    console.log("[服务] 前台通知已创建");
}

events.on("exit", function () {
    try {
        notice.cancel(NOTIFICATION_ID);
    } catch (e) {}
});

resetDailyFlag();

try {
    events.observeNotification();
} catch (e) {
    console.warn("[通知] 通知监听启动失败，仅保留备用定时: " + e);
    toast("通知监听启动失败，仅保留备用定时");
}

events.on("notification", function (notification) {
    resetDailyFlag();

    var pkg = notification.getPackageName();
    var title = notification.getTitle() || "";
    var notificationText = notification.getText() || "";

    if (pkg !== CONFIG.packageName) return;

    if (!isInTimeRange()) {
        console.log("[忽略] 不在生效时段");
        return;
    }

    var content = title + " " + notificationText;
    var matched = CONFIG.keywords.some(function (kw) {
        return content.indexOf(kw) >= 0;
    });

    if (!matched) {
        console.log("[忽略] 不匹配关键词: " + content.substring(0, 30));
        return;
    }

    console.log("  标题: " + title);
    console.log("  内容: " + notificationText);
    threads.start(function () {
        triggerCheckin("通知触发");
    });
});

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
