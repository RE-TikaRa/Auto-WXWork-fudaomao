"auto";
auto.waitFor();

var CONFIG = {
    packageName: "com.tencent.wework",
    reasonText: "离校",
    entryText: "辅导猫",
    keywords: ["打卡", "签到", "辅导猫"],
    startHour: 7,
    startMinute: 50,
    endHour: 8,
    endMinute: 10,
    fallbackHour: 10,
    fallbackMinute: 30
};

var POLL_INTERVAL = 200;
var MAX_WAIT = 10000;
var ANIM_DELAY = 500;
var GLOBAL_TIMEOUT = 180000;

var isRunning = false;
var todayTriggered = false;
var lastCheckedDate = "";

function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function resetDailyFlag() {
    var today = getTodayStr();
    if (lastCheckedDate !== today) {
        todayTriggered = false;
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

function isFallbackTime() {
    var now = new Date();
    return now.getHours() === CONFIG.fallbackHour && now.getMinutes() === CONFIG.fallbackMinute;
}

function formatTime(h, m) {
    return h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0');
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
    swipe(device.width / 2, device.height * 0.8, device.width / 2, device.height * 0.3, 300);
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

function doCheckin(globalStart) {
    var pageState = waitFor(function() {
        if (textContains("已签到").exists()) return "already_signed";
        var btn = text("范围外签到").findOnce();
        if (btn) return { btn: btn };
        var candidates = text("签到").find();
        for (var i = 0; i < candidates.length; i++) {
            var b = candidates[i].bounds();
            if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
                return { btn: candidates[i] };
            }
        }
        return null;
    }, MAX_WAIT, globalStart);
    
    if (pageState === "already_signed") {
        console.log(">>> 已签到，跳过");
        return "already_signed";
    }
    if (!pageState || !pageState.btn) {
        console.log(">>> 未找到签到按钮");
        return "no_button";
    }
    
    sleep(ANIM_DELAY);
    console.log(">>> 点击: " + pageState.btn.text());
    smartClick(pageState.btn);
    
    var continueBtn = waitFor(function() { return text("继续签到").findOnce(); }, 5000, globalStart);
    if (continueBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 继续签到");
        smartClick(continueBtn);
    }
    
    var photoBtn = waitFor(function() { return text("去拍照").findOnce(); }, 5000, globalStart);
    if (photoBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 去拍照");
        smartClick(photoBtn);
        
        var shutterBtn = waitFor(function() {
            return className("android.widget.ImageView").filter(function(w) {
                var b = w.bounds();
                return b.width() >= 150 && b.width() <= 200 && Math.abs(b.centerX() - device.width / 2) < 50;
            }).findOnce();
        }, 5000, globalStart);
        if (shutterBtn) {
            sleep(ANIM_DELAY);
            var b = shutterBtn.bounds();
            console.log(">>> 点击快门: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
        
        var usePhotoBtn = waitFor(function() { return text("使用照片").findOnce(); }, 5000, globalStart);
        if (usePhotoBtn) {
            sleep(ANIM_DELAY);
            console.log(">>> 点击: 使用照片");
            smartClick(usePhotoBtn);
        }
        
        var inputBox = waitFor(function() { return className("EditText").findOnce(); }, 5000, globalStart);
        if (inputBox) {
            sleep(ANIM_DELAY);
            console.log(">>> 填写: " + CONFIG.reasonText);
            smartClick(inputBox);
            sleep(300);
            inputBox.setText(CONFIG.reasonText);
            sleep(300);
            back();
        }
        
        var finalBtn = waitFor(function() { return textContains("完成签到").findOnce(); }, 3000, globalStart);
        if (finalBtn) {
            sleep(ANIM_DELAY);
            var b = finalBtn.bounds();
            console.log(">>> 点击完成签到: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
    }
    
    if (waitFor(function() { return textContains("已签到").exists() ? true : null; }, 5000, globalStart)) {
        console.log(">>> 签到成功！");
        return "success";
    }
    return "unknown";
}

function runCheckinFlow() {
    var globalStart = Date.now();
    
    console.log("\n===== 开始签到流程 =====");
    
    console.log(">>> 杀掉企业微信后台...");
    wakeUp();
    app.openAppSetting(CONFIG.packageName);
    var forceStopBtn = waitFor(function() {
        return text("强行停止").findOnce() || text("结束运行").findOnce();
    }, 3000, globalStart);
    if (forceStopBtn && forceStopBtn.clickable()) {
        forceStopBtn.click();
        sleep(300);
        var confirmBtn = waitFor(function() { return text("确定").findOnce(); }, 2000, globalStart);
        if (confirmBtn) confirmBtn.click();
    }
    back();
    sleep(300);
    
    console.log(">>> 启动企业微信...");
    app.launch(CONFIG.packageName);
    waitForPackage(CONFIG.packageName, 15000);
    
    var fudaomao = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 10000, globalStart);
    if (!fudaomao) {
        console.error(">>> 未找到辅导猫入口");
        return;
    }
    console.log(">>> 点击: 辅导猫");
    smartClick(fudaomao);
    
    var today = new Date();
    var todayStr = (today.getMonth() + 1).toString().padStart(2, '0') + "月" + 
                   today.getDate().toString().padStart(2, '0') + "日";
    console.log(">>> 今天: " + todayStr);
    
    sleep(2000);
    var activities = textContains(todayStr).find();
    console.log(">>> 找到 " + activities.length + " 个今日活动");
    
    if (activities.length === 0) {
        console.log(">>> 没有今日活动");
        return;
    }
    
    var results = [];
    for (var i = 0; i < activities.length; i++) {
        if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时，退出");
            break;
        }
        var activity = activities[i];
        var activityName = activity.text().substring(0, 25);
        console.log("\n===== 活动 " + (i + 1) + "/" + activities.length + ": " + activityName + " =====");
        
        smartClick(activity);
        
        var result;
        try {
            result = doCheckin(globalStart);
        } catch (e) {
            console.error("签到异常: " + e);
            result = "error";
        }
        results.push({ name: activityName, result: result });
        
        console.log(">>> 返回");
        back();
        sleep(1000);
        
        activities = textContains(todayStr).find();
        if (activities.length === 0) {
            console.log(">>> 活动列表丢失，尝试重新进入辅导猫");
            back();
            sleep(1000);
            var fudaomao2 = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 5000, globalStart);
            if (fudaomao2) {
                smartClick(fudaomao2);
                sleep(2000);
                activities = textContains(todayStr).find();
            }
            if (activities.length === 0) break;
        }
    }
    
    console.log("\n===== 结果汇总 =====");
    results.forEach(function(r, idx) {
        console.log((idx + 1) + ". " + r.name + " -> " + r.result);
    });
    console.log("===== 签到流程结束 =====\n");
}

function triggerCheckin(reason) {
    if (isRunning) {
        console.log("[忽略] 签到流程正在运行中");
        return;
    }
    
    console.log("\n[" + reason + "] " + new Date().toLocaleString());
    
    isRunning = true;
    todayTriggered = true;
    
    try {
        runCheckinFlow();
    } catch (e) {
        console.error("签到流程异常: " + e);
    }
    
    isRunning = false;
    console.log(">>> 签到流程锁已释放");
}

console.log("===== 辅导猫自动签到服务 =====");
console.log("监听包名: " + CONFIG.packageName);
console.log("触发关键词: " + CONFIG.keywords.join(", "));
console.log("通知触发时段: " + formatTime(CONFIG.startHour, CONFIG.startMinute) + " - " + formatTime(CONFIG.endHour, CONFIG.endMinute));
console.log("备用定时: " + formatTime(CONFIG.fallbackHour, CONFIG.fallbackMinute) + " (如通知未触发)");
console.log("");

events.observeNotification();

events.on("notification", function(notification) {
    resetDailyFlag();
    
    var pkg = notification.getPackageName();
    var title = notification.getTitle() || "";
    var text = notification.getText() || "";
    
    if (pkg !== CONFIG.packageName) return;
    
    if (!isInTimeRange()) {
        console.log("[忽略] 不在生效时段");
        return;
    }
    
    var content = title + " " + text;
    var matched = CONFIG.keywords.some(function(kw) {
        return content.indexOf(kw) >= 0;
    });
    
    if (!matched) {
        console.log("[忽略] 不匹配关键词: " + content.substring(0, 30));
        return;
    }
    
    console.log("  标题: " + title);
    console.log("  内容: " + text);
    triggerCheckin("通知触发");
});

console.log("监听中... (保持脚本运行)");

setInterval(function() {
    resetDailyFlag();
    
    if (!todayTriggered && isFallbackTime()) {
        console.log("[备用定时] 通知触发时段内未签到，执行备用签到");
        triggerCheckin("备用定时");
    }
}, 30000);
