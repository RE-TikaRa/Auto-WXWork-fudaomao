"auto";
auto.waitFor();

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

// 尝试创建前台服务通知
try {
    notice({
        title: "辅导猫自动签到",
        content: "签到服务运行中",
        notificationId: 10086,
        isSilent: true,
        autoCancel: false
    });
    console.log("[服务] 前台通知已创建");
    
    events.on("exit", function() {
        try { notice.cancel(10086); } catch (e) {}
    });
} catch (e) {
    console.warn("[服务] 无法创建前台通知: " + e);
}

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
    startHour: 7,      // 小时（24小时制）
    startMinute: 50,   // 分钟
    
    // 通知触发生效时段 - 结束时间
    endHour: 8,        // 小时（24小时制）
    endMinute: 10,     // 分钟
    
    // -------------------------------------------------------------------------
    // 备用定时配置
    // -------------------------------------------------------------------------
    
    // 备用定时签到时间
    // 如果在通知触发时段内没有成功签到（可能是通知被拦截或延迟），
    // 脚本会在此时间自动执行一次签到作为备用方案
    fallbackHour: 10,    // 小时（24小时制）
    fallbackMinute: 30   // 分钟
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

// 备用定时已触发标记 - 记录今天备用定时是否已执行
// 防止在同一分钟内重复触发备用定时
// 与 todayTriggered 独立，即使通知触发成功，也会记录备用定时状态
var fallbackTriggered = false;

// 上次检查的日期 - 用于检测日期变化
// 格式："年-月-日"，如 "2024-1-15"
// 当日期变化时，重置 todayTriggered 和 fallbackTriggered
var lastCheckedDate = "";

// ============================================================================
// 工具函数 - 时间和日期
// ============================================================================

/**
 * 获取今天的日期字符串
 * 
 * @returns {string} 格式为 "年-月-日"，如 "2024-1-15"
 * 
 * 【用途】
 * 用于检测日期是否变化，以便在新的一天重置签到标记。
 * 注意：月份和日期不补零，这是为了简化比较逻辑。
 */
function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

/**
 * 重置每日触发标记
 * 
 * 【触发时机】
 * - 每次收到通知时调用
 * - 每次定时器触发时调用
 * 
 * 【作用】
 * 检测日期是否变化，如果是新的一天，则重置：
 * - todayTriggered: 允许新的一天重新签到
 * - fallbackTriggered: 允许新的一天重新触发备用定时
 * 
 * 【为什么需要】
 * 脚本是常驻运行的，跨越午夜时需要自动重置状态，
 * 否则第二天的签到会被错误地跳过。
 */
function resetDailyFlag() {
    var today = getTodayStr();
    if (lastCheckedDate !== today) {
        todayTriggered = false;
        fallbackTriggered = false;
        lastCheckedDate = today;
        console.log("[日期变更] 重置每日触发标记");
    }
}

/**
 * 检查当前时间是否在通知触发生效时段内
 * 
 * @returns {boolean} 如果在时段内返回 true
 * 
 * 【时段配置】
 * 由 CONFIG.startHour/startMinute 和 CONFIG.endHour/endMinute 定义
 * 
 * 【计算方法】
 * 将时间转换为"从午夜开始的分钟数"进行比较：
 * - 7:50 = 7*60+50 = 470 分钟
 * - 8:10 = 8*60+10 = 490 分钟
 * - 当前时间在 [470, 490] 范围内则返回 true
 * 
 * 【注意】
 * 此函数不处理跨午夜的时段（如 23:00-01:00），
 * 如需支持请修改比较逻辑。
 */
function isInTimeRange() {
    var now = new Date();
    var h = now.getHours();
    var m = now.getMinutes();
    var current = h * 60 + m;
    var start = CONFIG.startHour * 60 + CONFIG.startMinute;
    var end = CONFIG.endHour * 60 + CONFIG.endMinute;
    return current >= start && current <= end;
}

/**
 * 检查当前时间是否是备用定时触发时间
 * 
 * @returns {boolean} 如果是备用定时时间返回 true
 * 
 * 【触发条件】
 * 当前小时 === CONFIG.fallbackHour 且 当前分钟 === CONFIG.fallbackMinute
 * 
 * 【注意】
 * 由于定时器每 30 秒检查一次，同一分钟内可能多次返回 true，
 * 因此需要配合 fallbackTriggered 标记防止重复触发。
 */
function isFallbackTime() {
    var now = new Date();
    return now.getHours() === CONFIG.fallbackHour && now.getMinutes() === CONFIG.fallbackMinute;
}

/**
 * 格式化时间为 "HH:MM" 格式
 * 
 * @param {number} h - 小时
 * @param {number} m - 分钟
 * @returns {string} 格式化后的时间字符串，如 "07:50"
 * 
 * 【用途】
 * 用于在控制台输出中显示友好的时间格式。
 */
function formatTime(h, m) {
    return h.toString().padStart(2, '0') + ":" + m.toString().padStart(2, '0');
}

// ============================================================================
// 工具函数 - 设备操作
// ============================================================================

/**
 * 唤醒屏幕并解锁
 * 
 * @returns {boolean} 成功返回 true，失败返回 false
 * 
 * 【执行步骤】
 * 1. 检查屏幕是否已亮起，如果是则直接返回 true
 * 2. 调用 device.wakeUp() 唤醒屏幕
 * 3. 等待 500ms 让屏幕完全亮起
 * 4. 再次检查屏幕状态，如果仍未亮起则返回 false
 * 5. 执行上滑手势解锁屏幕
 * 6. 等待 500ms 让解锁动画完成
 * 
 * 【上滑参数】
 * - 起点：屏幕中央水平位置，垂直位置 80%（靠近底部）
 * - 终点：屏幕中央水平位置，垂直位置 30%（靠近顶部）
 * - 持续时间：300ms
 * 
 * 【前提条件】
 * 手机需要设置为无锁屏密码，或使用 Smart Lock 等方式保持解锁状态。
 * 如果有锁屏密码，此函数无法完成解锁。
 */
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

// ============================================================================
// 工具函数 - UI 等待和点击
// ============================================================================

/**
 * 等待某个条件满足（轮询模式）
 * 
 * @param {Function} finder - 查找函数，返回非假值表示找到
 * @param {number} [timeout=MAX_WAIT] - 超时时间（毫秒）
 * @param {number} [globalStart] - 全局开始时间戳，用于全局超时检查
 * @returns {*} finder 返回的结果，超时返回 null
 * 
 * 【工作原理】
 * 1. 每隔 POLL_INTERVAL 毫秒调用一次 finder 函数
 * 2. 如果 finder 返回非假值（truthy），立即返回该值
 * 3. 如果超过 timeout 时间仍未找到，返回 null
 * 4. 如果提供了 globalStart，还会检查全局超时
 * 
 * 【为什么用轮询而不是固定延迟】
 * - 轮询可以在元素出现后立即响应，不会浪费时间
 * - 固定延迟可能等待过长（元素早就出现了）或过短（元素还没出现）
 * 
 * 【finder 函数示例】
 * - 查找文本：function() { return text("签到").findOnce(); }
 * - 检查存在：function() { return textContains("已签到").exists() ? true : null; }
 * - 多条件：function() { return text("A").findOnce() || text("B").findOnce(); }
 * 
 * 【全局超时】
 * globalStart 参数用于防止整个签到流程执行过长。
 * 即使单个等待没有超时，如果整体流程超过 GLOBAL_TIMEOUT，也会中止。
 */
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

/**
 * 智能点击控件（三级回退策略）
 * 
 * @param {UiObject} widget - 要点击的控件对象
 * @returns {boolean} 点击是否成功
 * 
 * 【三级回退策略】
 * 
 * 第一级：直接点击控件
 * - 如果控件本身 clickable() 为 true，直接调用 widget.click()
 * - 这是最可靠的方式，因为使用了无障碍服务的点击
 * 
 * 第二级：点击父控件
 * - 有些控件本身不可点击，但其父容器可点击
 * - 例如：TextView 在 LinearLayout 中，LinearLayout 设置了点击事件
 * - 此时点击父控件可以触发事件
 * 
 * 第三级：坐标点击
 * - 如果控件和父控件都不可点击，使用坐标点击
 * - 获取控件的边界框，计算中心点坐标，模拟点击
 * - 这是最后的手段，可能不如无障碍点击可靠
 * 
 * 【为什么需要三级回退】
 * 不同应用的 UI 实现方式不同，有些控件虽然视觉上可点击，
 * 但 clickable 属性为 false。通过三级回退可以最大程度保证点击成功。
 */
function smartClick(widget) {
    if (!widget) return false;
    if (widget.clickable()) return widget.click();
    var p = widget.parent();
    if (p && p.clickable()) return p.click();
    var b = widget.bounds();
    return click(b.centerX(), b.centerY());
}

// ============================================================================
// 签到核心逻辑
// ============================================================================

/**
 * 执行单个活动的签到操作
 * 
 * @param {number} globalStart - 全局开始时间戳，用于超时控制
 * @returns {string} 签到结果：
 *   - "already_signed": 已签到，跳过
 *   - "no_button": 未找到签到按钮
 *   - "success": 签到成功
 *   - "unknown": 未知结果（可能成功也可能失败）
 * 
 * 【签到流程】
 * 
 * 1. 检测页面状态
 *    - 如果显示"已签到"，直接返回 already_signed
 *    - 如果有"范围外签到"按钮，使用该按钮
 *    - 否则查找普通"签到"按钮（通过 Y 坐标过滤排除底部导航栏）
 * 
 * 2. 点击签到按钮
 * 
 * 3. 处理"继续签到"弹窗（如果出现）
 *    - 某些情况下会弹出确认框
 * 
 * 4. 处理拍照流程（如果需要）
 *    a. 点击"去拍照"
 *    b. 处理相机权限弹窗（允许/始终允许/仅在使用中允许）
 *    c. 点击快门按钮（通过尺寸和位置识别）
 *    d. 点击"使用照片"
 *    e. 填写签到原因
 *    f. 收起键盘（调用 back()）
 *    g. 点击"完成签到"
 * 
 * 5. 验证签到结果
 *    - 检查是否出现"已签到"文本
 * 
 * 【签到按钮识别】
 * 通过 Y 坐标过滤签到按钮：
 * - Y > 300: 排除顶部状态栏区域
 * - Y < 屏幕高度 * 0.7: 排除底部导航栏区域
 * 这样可以准确定位页面中央的签到按钮
 * 
 * 【快门按钮识别】
 * 相机界面的快门按钮通常是：
 * - 位于屏幕水平中央（centerX 与屏幕中心相差 < 50px）
 * - 尺寸为屏幕宽度的 10%-20%
 * - 类型为 ImageView
 */
function doCheckin(globalStart) {
    // -------------------------------------------------------------------------
    // 步骤 1: 检测页面状态，查找签到按钮
    // -------------------------------------------------------------------------
    var pageState = waitFor(function() {
        // 检查是否已签到
        if (textContains("已签到").exists()) return "already_signed";
        
        // 优先查找"范围外签到"按钮（不在签到范围内时显示）
        var btn = text("范围外签到").findOnce();
        if (btn) return { btn: btn };
        
        // 查找普通"签到"按钮，通过 Y 坐标过滤
        var candidates = text("签到").find();
        for (var i = 0; i < candidates.length; i++) {
            var b = candidates[i].bounds();
            // 过滤条件：排除顶部（Y > 300）和底部（Y < 70% 屏幕高度）
            if (b.centerY() < device.height * 0.7 && b.centerY() > 300) {
                return { btn: candidates[i] };
            }
        }
        return null;
    }, MAX_WAIT, globalStart);
    
    // 处理检测结果
    if (pageState === "already_signed") {
        console.log(">>> 已签到，跳过");
        return "already_signed";
    }
    if (!pageState || !pageState.btn) {
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
    var continueBtn = waitFor(function() { return text("继续签到").findOnce(); }, 5000, globalStart);
    if (continueBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 继续签到");
        smartClick(continueBtn);
    }
    
    // -------------------------------------------------------------------------
    // 步骤 4: 处理拍照流程（如果需要）
    // -------------------------------------------------------------------------
    var photoBtn = waitFor(function() { return text("去拍照").findOnce(); }, 5000, globalStart);
    if (photoBtn) {
        sleep(ANIM_DELAY);
        console.log(">>> 点击: 去拍照");
        smartClick(photoBtn);
        
        // 4a. 处理相机权限弹窗
        // 不同系统的权限按钮文本可能不同，需要匹配多种情况
        var permissionBtn = waitFor(function() {
            return text("允许").findOnce() || text("始终允许").findOnce() || textContains("仅在使用").findOnce();
        }, 2000, globalStart);
        if (permissionBtn) {
            console.log(">>> 处理权限弹窗");
            smartClick(permissionBtn);
            sleep(500);
        }
        
        // 4b. 点击快门按钮
        // 通过尺寸和位置识别快门按钮（屏幕中央的圆形按钮）
        var shutterBtn = waitFor(function() {
            var minSize = device.width * 0.1;  // 最小尺寸：屏幕宽度的 10%
            var maxSize = device.width * 0.2;  // 最大尺寸：屏幕宽度的 20%
            return className("android.widget.ImageView").filter(function(w) {
                var b = w.bounds();
                // 条件：尺寸在范围内，且水平位置接近屏幕中央
                return b.width() >= minSize && b.width() <= maxSize && Math.abs(b.centerX() - device.width / 2) < 50;
            }).findOnce();
        }, 5000, globalStart);
        if (shutterBtn) {
            sleep(ANIM_DELAY);
            var b = shutterBtn.bounds();
            console.log(">>> 点击快门: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
        
        // 4c. 点击"使用照片"
        var usePhotoBtn = waitFor(function() { return text("使用照片").findOnce(); }, 5000, globalStart);
        if (usePhotoBtn) {
            sleep(ANIM_DELAY);
            console.log(">>> 点击: 使用照片");
            smartClick(usePhotoBtn);
        }
        
        // 4d. 填写签到原因
        var inputBox = waitFor(function() { return className("EditText").findOnce(); }, 5000, globalStart);
        if (inputBox) {
            sleep(ANIM_DELAY);
            console.log(">>> 填写: " + CONFIG.reasonText);
            smartClick(inputBox);  // 先点击输入框获取焦点
            sleep(300);
            inputBox.setText(CONFIG.reasonText);  // 设置文本
            sleep(300);
            back();  // 收起键盘，否则可能遮挡"完成签到"按钮
        }
        
        // 4e. 点击"完成签到"
        var finalBtn = waitFor(function() { return textContains("完成签到").findOnce(); }, 3000, globalStart);
        if (finalBtn) {
            sleep(ANIM_DELAY);
            var b = finalBtn.bounds();
            console.log(">>> 点击完成签到: (" + b.centerX() + ", " + b.centerY() + ")");
            click(b.centerX(), b.centerY());
        }
    }
    
    // -------------------------------------------------------------------------
    // 步骤 5: 验证签到结果
    // -------------------------------------------------------------------------
    if (waitFor(function() { return textContains("已签到").exists() ? true : null; }, 5000, globalStart)) {
        console.log(">>> 签到成功！");
        return "success";
    }
    return "unknown";
}

// ============================================================================
// 签到流程控制
// ============================================================================

/**
 * 执行完整的签到流程
 * 
 * @returns {boolean} 是否有至少一个活动签到成功
 * 
 * 【完整流程】
 * 
 * 1. 唤醒屏幕并解锁
 * 
 * 2. 杀掉企业微信后台
 *    - 打开应用设置页面
 *    - 点击"强行停止"或"结束运行"
 *    - 确认停止
 *    - 这样做是为了确保企业微信从干净状态启动，避免页面状态异常
 * 
 * 3. 启动企业微信
 *    - 等待应用完全启动（检测到辅导猫入口或工作台）
 * 
 * 4. 进入辅导猫
 *    - 查找并点击辅导猫入口
 * 
 * 5. 查找今日活动
 *    - 通过日期文本（如"01月15日"）查找今日的签到活动
 * 
 * 6. 遍历处理每个活动
 *    - 使用 while 循环，每次处理第一个活动
 *    - 这样做是因为签到后活动可能从列表中消失，使用索引会错位
 *    - 每个活动调用 doCheckin() 执行签到
 *    - 签到后返回活动列表，刷新活动列表
 * 
 * 7. 输出结果汇总
 * 
 * 【为什么要杀掉企业微信后台】
 * 企业微信可能停留在某个页面（如聊天界面），直接启动可能无法
 * 正确导航到辅导猫。强制停止后重新启动可以确保从主界面开始。
 * 
 * 【活动列表丢失处理】
 * 签到完成后返回时，如果活动列表为空（可能是页面刷新或导航问题），
 * 会尝试返回上一级并重新进入辅导猫页面。
 */
function runCheckinFlow() {
    // 记录流程开始时间，用于全局超时控制
    var globalStart = Date.now();
    
    console.log("\n===== 开始签到流程 =====");
    
    // -------------------------------------------------------------------------
    // 步骤 1: 唤醒屏幕
    // -------------------------------------------------------------------------
    if (!wakeUp()) {
        console.error(">>> 唤醒失败");
        return false;
    }
    
    // -------------------------------------------------------------------------
    // 步骤 2: 杀掉企业微信后台，确保干净启动
    // -------------------------------------------------------------------------
    console.log(">>> 杀掉企业微信后台...");
    app.openAppSetting(CONFIG.packageName);  // 打开应用设置页面
    var forceStopBtn = waitFor(function() {
        // 不同系统的按钮文本可能不同
        return text("强行停止").findOnce() || text("结束运行").findOnce();
    }, 3000, globalStart);
    if (forceStopBtn && forceStopBtn.clickable()) {
        forceStopBtn.click();
        sleep(300);
        // 点击确认对话框
        var confirmBtn = waitFor(function() { return text("确定").findOnce(); }, 2000, globalStart);
        if (confirmBtn) confirmBtn.click();
    }
    back();  // 返回上一页
    sleep(300);
    
    // -------------------------------------------------------------------------
    // 步骤 3: 启动企业微信
    // -------------------------------------------------------------------------
    console.log(">>> 启动企业微信...");
    app.launch(CONFIG.packageName);
    sleep(3000);  // 等待应用启动动画
    // 检测应用是否成功启动（能看到辅导猫入口或工作台）
    var appLaunched = waitFor(function() { return textContains(CONFIG.entryText).exists() || textContains("工作台").exists(); }, 15000, globalStart);
    if (!appLaunched) {
        console.error(">>> 企业微信启动超时");
        return false;
    }
    
    // -------------------------------------------------------------------------
    // 步骤 4: 进入辅导猫
    // -------------------------------------------------------------------------
    var fudaomao = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 10000, globalStart);
    if (!fudaomao) {
        console.error(">>> 未找到辅导猫入口");
        return false;
    }
    console.log(">>> 点击: 辅导猫");
    smartClick(fudaomao);
    
    // -------------------------------------------------------------------------
    // 步骤 5: 查找今日活动
    // -------------------------------------------------------------------------
    // 构造今日日期字符串，格式如 "01月15日"
    var today = new Date();
    var todayStr = (today.getMonth() + 1).toString().padStart(2, '0') + "月" + 
                   today.getDate().toString().padStart(2, '0') + "日";
    console.log(">>> 今天: " + todayStr);
    
    sleep(2000);  // 等待页面加载
    var activities = textContains(todayStr).find();
    console.log(">>> 找到 " + activities.length + " 个今日活动");
    
    if (activities.length === 0) {
        console.log(">>> 没有今日活动");
        return false;
    }
    
    // -------------------------------------------------------------------------
    // 步骤 6: 遍历处理每个活动
    // -------------------------------------------------------------------------
    var results = [];        // 存储每个活动的签到结果
    var processedCount = 0;  // 已处理的活动数量
    var hasSuccess = false;  // 是否有签到成功的活动
    
    // 使用 while 循环而不是 for 循环
    // 原因：签到后活动可能从列表中消失，使用索引会导致错位
    // 每次都处理第一个活动，处理完后刷新列表
    while (activities.length > 0) {
        // 检查全局超时
        if (Date.now() - globalStart > GLOBAL_TIMEOUT) {
            console.error(">>> 全局超时，退出");
            break;
        }
        
        // 总是处理第一个活动，避免索引错位
        var activity = activities[0];
        var activityName = (activity.text() || "").substring(0, 25);  // 截取活动名称前25个字符
        processedCount++;
        console.log("\n===== 活动 " + processedCount + ": " + activityName + " =====");
        
        // 点击进入活动详情
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
        results.push({ name: activityName, result: result });
        
        // 返回活动列表
        console.log(">>> 返回");
        back();
        sleep(1000);
        
        // 刷新活动列表
        activities = textContains(todayStr).find();
        
        // 如果活动列表为空，可能是页面状态异常，尝试恢复
        if (activities.length === 0) {
            console.log(">>> 活动列表丢失，尝试重新进入辅导猫");
            back();  // 再返回一级
            sleep(1000);
            var fudaomao2 = waitFor(function() { return textContains(CONFIG.entryText).findOnce(); }, 5000, globalStart);
            if (fudaomao2) {
                smartClick(fudaomao2);
                sleep(2000);
                activities = textContains(todayStr).find();
            }
        }
    }
    
    // -------------------------------------------------------------------------
    // 步骤 7: 输出结果汇总
    // -------------------------------------------------------------------------
    console.log("\n===== 结果汇总 =====");
    results.forEach(function(r, idx) {
        console.log((idx + 1) + ". " + r.name + " -> " + r.result);
    });
    console.log("===== 签到流程结束 =====\n");
    return hasSuccess;
}

/**
 * 触发签到（带运行锁保护）
 * 
 * @param {string} reason - 触发原因，用于日志记录（如"通知触发"、"备用定时"）
 * @returns {boolean} 签到是否成功
 * 
 * 【运行锁机制】
 * 使用 isRunning 变量作为运行锁，防止签到流程并发执行。
 * 
 * 场景：用户可能在短时间内收到多条通知，如果不加锁，
 * 每条通知都会触发一次签到流程，导致混乱。
 * 
 * 【成功标记】
 * 只有签到成功（hasSuccess = true）才会设置 todayTriggered = true。
 * 这样如果签到失败，备用定时仍然会尝试签到。
 */
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
        success = runCheckinFlow();
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
console.log("通知触发时段: " + formatTime(CONFIG.startHour, CONFIG.startMinute) + " - " + formatTime(CONFIG.endHour, CONFIG.endMinute));
console.log("备用定时: " + formatTime(CONFIG.fallbackHour, CONFIG.fallbackMinute) + " (如通知未触发)");
console.log("");

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

/**
 * 通知事件处理函数
 * 
 * @param {Notification} notification - 通知对象，包含包名、标题、内容等信息
 * 
 * 【处理流程】
 * 1. 重置每日标记（检测日期变化）
 * 2. 检查包名是否为企业微信
 * 3. 检查是否在生效时段内
 * 4. 检查是否匹配关键词
 * 5. 如果全部通过，触发签到
 */
events.on("notification", function(notification) {
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
    var matched = CONFIG.keywords.some(function(kw) {
        return content.indexOf(kw) >= 0;
    });
    
    if (!matched) {
        console.log("[忽略] 不匹配关键词: " + content.substring(0, 30));
        return;
    }
    
    // 所有条件通过，触发签到
    console.log("  标题: " + title);
    console.log("  内容: " + notificationText);
    triggerCheckin("通知触发");
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
// 同时满足以下三个条件时触发：
// 1. todayTriggered === false（今天还没有成功签到）
// 2. fallbackTriggered === false（今天备用定时还没有执行过）
// 3. isFallbackTime() === true（当前时间是备用定时时间）
//
// 【定时器间隔】
// 每 30 秒检查一次，确保不会错过备用定时时间。
// 由于检查间隔是 30 秒，同一分钟内可能检查 2 次，
// 因此需要 fallbackTriggered 标记防止重复触发。
// ============================================================================

console.log("监听中... (保持脚本运行)");

setInterval(function() {
    // 每次定时器触发时检查日期是否变化
    resetDailyFlag();
    
    // 检查是否需要执行备用定时签到
    // 条件：今天未签到成功 且 备用定时未执行 且 当前是备用定时时间
    if (!todayTriggered && !fallbackTriggered && isFallbackTime()) {
        fallbackTriggered = true;  // 标记备用定时已执行，防止重复触发
        console.log("[备用定时] 通知触发时段内未签到，执行备用签到");
        triggerCheckin("备用定时");
    }
}, 30000);  // 每 30 秒检查一次
