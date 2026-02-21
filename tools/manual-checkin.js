"auto";
auto.waitFor();

// 手动模式脚本：
// - 不依赖通知与备用定时
// - 立即执行一次完整签到流程，便于排查与验证
var CONFIG = {
    packageName: "com.tencent.wework",
    reasonText: "离校",
    entryText: "辅导猫",
};

// 启动前验证无障碍，避免后续选择器全部失效。
try {
    selector().exists();
    console.log("[服务] 无障碍服务正常");
} catch (e) {
    toast("无障碍服务异常，请重新开启");
    console.error("[服务] 无障碍服务异常: " + e);
    exit();
}

// 清理 AutoJs 内部遗留弹窗，防止遮挡后续操作。
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

// 轮询间隔/超时参数（手动模式与自动模式保持一致）。
var POLL_INTERVAL = 200;
var MAX_WAIT = 10000;
var ANIM_DELAY = 500;
var GLOBAL_TIMEOUT = 180000;
var globalStart = Date.now();

// 调试辅助：输出页面关键词与可点击控件信息。
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

// 确保屏幕亮起并可交互。
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

// 统一轮询等待，包含全局超时保护。
function waitFor(finder, timeout) {
    timeout = timeout || MAX_WAIT;
    var start = Date.now();
    while (Date.now() - start < timeout) {
        // 检查全局超时
        if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时");
            return null;
        }
        var result = finder();
        if (result) return result;
        sleep(POLL_INTERVAL);
    }
    return null;
}

// 点击回退策略：自身可点 -> 父节点可点 -> 坐标点击。
function smartClick(widget) {
    if (!widget) return false;
    if (widget.clickable()) return widget.click();
    var p = widget.parent();
    if (p && p.clickable()) return p.click();
    var b = widget.bounds();
    return click(b.centerX(), b.centerY());
}

function doCheckin() {
    // 进入活动详情页后先打调试快照，便于复盘。
    debugPage("进入活动详情页");

    // 第 1 阶段：识别当前页是否可签到、已签到、或无按钮。
    var pageState = waitFor(function () {
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

        return null; // 继续轮询
    }, MAX_WAIT);

    console.log(">>> pageState = " + JSON.stringify(pageState));

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

    sleep(1000);
    debugPage("点击签到按钮后");

    // 第 2 阶段：处理“继续签到”中间页。
    var continueBtn = waitFor(function () {
        return text("继续签到").findOnce();
    }, 5000);
    if (continueBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 继续签到");
        smartClick(continueBtn);
    }

    // 注意："为何不能签到？"是页面上的固定链接，不能作为过期判断依据

    // 第 3 阶段：若仍是未签到状态，尝试点击底部主操作按钮。
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

        console.log(
            ">>> 点击底部签到按钮: Y=" + bottomSignBtn.bounds().centerY(),
        );
        sleep(ANIM_DELAY);
        click(
            bottomSignBtn.bounds().centerX(),
            bottomSignBtn.bounds().centerY(),
        );
    }

    // 第 4 阶段：拍照签到链路（权限、拍照、使用照片、填写原因、提交）。
    var photoBtn = waitFor(function () {
        return text("去拍照").findOnce();
    }, 5000);
    if (photoBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 去拍照");
        smartClick(photoBtn);

        var permissionBtn = waitFor(function () {
            return (
                text("允许").findOnce() ||
                text("始终允许").findOnce() ||
                textContains("仅在使用").findOnce()
            );
        }, 2000);
        if (permissionBtn) {
            console.log(">>> 处理权限弹窗");
            smartClick(permissionBtn);
            sleep(500); // 等待权限弹窗关闭
        }

        var shutterBtn = waitFor(function () {
            var minSize = device.width * 0.1; // 最小宽度：屏幕宽度的 10%
            var maxSize = device.width * 0.2; // 最大宽度：屏幕宽度的 20%
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
        }, 5000);
        if (shutterBtn) {
            sleep(ANIM_DELAY);
            var b = shutterBtn.bounds();
            console.log(
                ">>> 点击快门: (" + b.centerX() + ", " + b.centerY() + ")",
            );
            click(b.centerX(), b.centerY());
        }

        var usePhotoBtn = waitFor(function () {
            return text("使用照片").findOnce();
        }, 5000);
        if (usePhotoBtn) {
            sleep(ANIM_DELAY);
            console.log(">>> 点击: 使用照片");
            smartClick(usePhotoBtn);
        }

        // 流程：点击输入框 → 输入文本 → 收起键盘
        // 【重要】必须先收起键盘再点击提交按钮
        var inputBox = waitFor(function () {
            return className("EditText").findOnce();
        }, 5000);
        if (inputBox) {
            sleep(ANIM_DELAY);
            console.log(">>> 填写: " + CONFIG.reasonText);
            smartClick(inputBox); // 聚焦输入框
            sleep(300); // 等待键盘弹出
            inputBox.setText(CONFIG.reasonText); // 设置文本
            sleep(300); // 等待文本输入完成
            back(); // 收起键盘（关键步骤！）
        }

        var finalBtn = waitFor(function () {
            return textContains("完成签到").findOnce();
        }, 3000);
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
        waitFor(function () {
            return textContains("已签到").exists() ? true : null;
        }, 5000)
    ) {
        console.log(">>> 签到成功！");
        return "success";
    }

    return "unknown";
}

console.log("===== 手动签到 =====");

if (!wakeUp()) {
    console.error(">>> 唤醒失败，退出");
    exit();
}

var MAX_LAUNCH_RETRIES = 3;
var appLaunched = false;

// 阶段 A：重启并启动企业微信，确保落到可操作首页。
for (var retry = 1; retry <= MAX_LAUNCH_RETRIES; retry++) {
    console.log(
        ">>> 尝试启动企业微信 (" + retry + "/" + MAX_LAUNCH_RETRIES + ")",
    );

    console.log(">>> 杀掉企业微信后台...");
    app.openAppSetting(CONFIG.packageName);
    var forceStopBtn = waitFor(function () {
        return text("强行停止").findOnce() || text("结束运行").findOnce();
    }, 3000);

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
            var confirmBtn = waitFor(function () {
                return text("确定").findOnce();
            }, 2000);
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

    appLaunched = waitFor(function () {
        return (
            textContains(CONFIG.entryText).exists() ||
            textContains("工作台").exists()
        );
    }, 30000);

    if (appLaunched) {
        console.log(">>> 企业微信启动成功");

        var msgTab = text("消息")
            .boundsInside(0, device.height * 0.9, device.width, device.height)
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
    console.error(">>> 企业微信启动失败，已重试 " + MAX_LAUNCH_RETRIES + " 次");
    debugPage("企业微信启动失败");
    toast("企业微信启动失败");
    alert("签到失败", "企业微信启动超时，请检查应用状态");
    exit();
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

// 阶段 B：进入辅导猫并读取今日活动列表。
for (var pageRetry = 1; pageRetry <= MAX_PAGE_RETRIES; pageRetry++) {
    var fudaomao = waitFor(function () {
        return textContains(CONFIG.entryText).findOnce();
    }, 10000);
    if (!fudaomao) {
        console.error(">>> 未找到辅导猫入口，退出");
        debugPage("未找到辅导猫入口");
        exit();
    }
    console.log(
        ">>> 点击: 辅导猫 (尝试 " + pageRetry + "/" + MAX_PAGE_RETRIES + ")",
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
    console.log(">>> 没有今日活动，退出");
    debugPage("没有今日活动");
    toast("没有今日活动");
    alert("签到完成", "今日没有需要签到的活动");
    exit();
}

var todoList = [];
var now = new Date();
console.log(">>> 当前时间: " + now.toLocaleString());

// 阶段 C：预扫描活动，解析截止时间并标记是否过期。
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
    var deadline = item.deadlineStr ? " (截止:" + item.deadlineStr + ")" : "";
    console.log(idx + 1 + ". " + status + " " + item.name + deadline);
});
console.log("有效活动: " + validCount + "/" + todoList.length);
console.log("======================\n");

var results = [];
var processedNames = {};

// 阶段 D：逐个活动执行签到。
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
    sleep(1500);

    var result;
    try {
        result = doCheckin();
    } catch (e) {
        console.error("签到异常: " + e);
        result = "error";
    }
    console.log(">>> 签到结果: " + result);

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

// 阶段 E：结果归类汇总并弹窗展示。
results.forEach(function (r, idx) {
    var deadline = r.deadline ? " (截止:" + r.deadline + ")" : "";
    console.log(idx + 1 + ". " + r.name + deadline + " -> " + r.result);
    if (r.result === "success") successCount++;
    else if (r.result === "already_signed") skipCount++;
    else if (r.result === "missed") {
        missedCount++;
        missedNames.push(r.name + (r.deadline ? "\n  截止:" + r.deadline : ""));
    } else {
        failCount++;
        failedNames.push(r.name + (r.deadline ? "\n  截止:" + r.deadline : ""));
    }
});
console.log("=== 完成 ===");

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
