"auto";
// ============================================================
// 界面分析工具 - 分析当前屏幕所有控件
// 用途：调试时查看当前页面的控件结构，不执行任何操作
// ============================================================

auto.waitFor();

// 获取当前 Activity 信息
var currentActivity = currentActivity();
var currentPackage = currentPackage();

console.log("========== 当前界面信息 ==========");
console.log("包名: " + currentPackage);
console.log("Activity: " + currentActivity);
console.log("");

// 获取屏幕尺寸
var dm = context.getResources().getDisplayMetrics();
console.log("屏幕尺寸: " + dm.widthPixels + " x " + dm.heightPixels);
console.log("");

// ============================================================
// 1. 查找所有文本控件
// ============================================================
console.log("========== 所有文本控件 ==========");
var allTexts = className("android.widget.TextView").find();
console.log("找到 " + allTexts.length + " 个 TextView");
allTexts.forEach(function(item, index) {
    var t = item.text();
    if (t && t.trim()) {
        var b = item.bounds();
        console.log("[" + index + "] 文本: \"" + t + "\"");
        console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
        console.log("    可点击: " + item.clickable() + ", 可用: " + item.enabled());
    }
});
console.log("");

// ============================================================
// 2. 查找所有 View 控件（WebView 中的元素通常是 View）
// ============================================================
console.log("========== 所有 View 控件（含文本）==========");
var allViews = className("android.view.View").find();
var viewsWithText = [];
allViews.forEach(function(item) {
    var t = item.text() || item.desc();
    if (t && t.trim()) {
        viewsWithText.push(item);
    }
});
console.log("找到 " + viewsWithText.length + " 个有文本的 View");
viewsWithText.forEach(function(item, index) {
    var t = item.text() || item.desc();
    var b = item.bounds();
    console.log("[" + index + "] 文本: \"" + t + "\"");
    console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
    console.log("    可点击: " + item.clickable() + ", 可用: " + item.enabled());
    // 检查父控件
    var p = item.parent();
    if (p) {
        console.log("    父控件可点击: " + p.clickable());
    }
});
console.log("");

// ============================================================
// 3. 查找所有可点击控件
// ============================================================
console.log("========== 所有可点击控件 ==========");
var clickables = clickable(true).find();
console.log("找到 " + clickables.length + " 个可点击控件");
clickables.forEach(function(item, index) {
    var t = item.text() || item.desc() || "(无文本)";
    var b = item.bounds();
    var cls = item.className();
    console.log("[" + index + "] " + cls);
    console.log("    文本: \"" + t + "\"");
    console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
    console.log("    中心点: (" + b.centerX() + ", " + b.centerY() + ")");
});
console.log("");

// ============================================================
// 4. 查找输入框
// ============================================================
console.log("========== 输入框 ==========");
var editTexts = className("android.widget.EditText").find();
console.log("找到 " + editTexts.length + " 个 EditText");
editTexts.forEach(function(item, index) {
    var t = item.text();
    var b = item.bounds();
    console.log("[" + index + "] 内容: \"" + t + "\"");
    console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
    console.log("    focused: " + item.focused());
});
console.log("");

// ============================================================
// 5. 特别查找：完成签到按钮
// ============================================================
console.log("========== 特别查找：完成签到 ==========");

// 方法1：通过 text 查找
var btn1 = text("完成签到").findOnce();
if (btn1) {
    var b = btn1.bounds();
    console.log("[text] 找到！");
    console.log("    类名: " + btn1.className());
    console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
    console.log("    中心点: (" + b.centerX() + ", " + b.centerY() + ")");
    console.log("    可点击: " + btn1.clickable());
    var p = btn1.parent();
    if (p) {
        var pb = p.bounds();
        console.log("    父控件: " + p.className() + ", 可点击: " + p.clickable());
        console.log("    父控件位置: (" + pb.left + ", " + pb.top + ") - (" + pb.right + ", " + pb.bottom + ")");
    }
} else {
    console.log("[text] 未找到");
}

// 方法2：通过 textContains 查找
var btn2 = textContains("完成").findOnce();
if (btn2) {
    var b = btn2.bounds();
    console.log("[textContains] 找到: \"" + btn2.text() + "\"");
    console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
    console.log("    中心点: (" + b.centerX() + ", " + b.centerY() + ")");
} else {
    console.log("[textContains] 未找到");
}

// 方法3：通过 desc 查找
var btn3 = desc("完成签到").findOnce();
if (btn3) {
    var b = btn3.bounds();
    console.log("[desc] 找到！");
    console.log("    位置: (" + b.left + ", " + b.top + ") - (" + b.right + ", " + b.bottom + ")");
} else {
    console.log("[desc] 未找到");
}

console.log("");
console.log("========== 分析完成 ==========");
console.log("提示：如果键盘遮挡按钮，可以：");
console.log("1. 使用 back() 收起键盘");
console.log("2. 点击输入框外的空白区域");
console.log("3. 直接使用坐标点击（如果按钮位置已知）");
