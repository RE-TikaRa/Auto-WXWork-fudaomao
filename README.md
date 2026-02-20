# 辅导猫自动签到脚本

基于 AutoJs6 的企业微信辅导猫自动签到工具，支持多活动批量签到。

## 功能

- 自动杀掉企业微信后台并重启
- 自动进入辅导猫
- 自动识别今日所有打卡活动
- 跳过已签到活动
- 支持范围外签到（自动填写原因）
- 自动拍照签到
- 通知触发自动签到
- 全局超时保护，防止卡死

## 环境要求

- Android 7.0 (`API 24`) 及以上
- [AutoJs6](https://github.com/SuperMonster003/AutoJs6/releases/latest) (`开源免费`)
- 企业微信已登录并加入辅导猫
- 无障碍服务已开启
- 通知访问权限（用于通知触发）
- 设备无锁屏密码，或已启用 Smart Lock 信任

## 使用方法

### 1. 检查设备环境

- 操作系统: [Android 7.0](https://zh.wikipedia.org/wiki/Android_Nougat) (`API 24`) 及以上
- 查看方式：设置 → 关于手机 → Android 版本

### 2. 下载并安装 AutoJs6

1. 访问 [AutoJs6 发布页](https://github.com/SuperMonster003/AutoJs6/releases/latest)
2. 下载最新版本的 APK 文件（如 `AutoJs6-v6.x.x.apk`）
3. 在手机上安装 APK（可能需要允许"安装未知来源应用"）
4. 安装完成后打开 AutoJs6

> 本项目依赖于 [Rhino 引擎](https://github.com/mozilla/rhino) 及 AutoJs6 的 API

### 3. 下载项目

1. 在电脑或手机浏览器中访问 [Releases 页面](../../releases/latest) 下载最新版本压缩包
2. 将下载的 `auto-workwx-master.zip` 解压
3. 使用文件管理器，将解压后的 `auto-workwx-master` 文件夹复制到手机
4. 找到 AutoJs6 的工作目录：
   - 打开 AutoJs6 → 点击左上角菜单 → 设置 → 查看当前工作目录路径
   - 默认路径通常为：
     - 中文系统：`/sdcard/脚本/`
     - 英文系统：`/sdcard/Scripts/`
     - 若不存在，可以在任意位置创建文件夹将工作目录改为你创建的文件夹
5. 将项目文件夹移动或复制到工作目录中
6. 回到 AutoJs6，下拉刷新，应该能看到 `auto-workwx-master` 项目

> 推荐使用MT管理器


### 4. 授予权限

AutoJs6 需要以下权限才能正常运行脚本：

**无障碍服务（必需）**
1. 打开手机设置
2. 进入：设置 → 无障碍 → 已下载的应用 → AutoJs6
3. 开启无障碍服务开关
4. 在弹出的确认框中点击"允许"

**通知访问权限（自动签到必需）**
1. 打开手机设置
2. 进入：设置 → 应用 → 特殊应用权限 → 通知访问
3. 找到 AutoJs6 并开启

**后台运行权限（防止被系统杀掉）**
1. 打开手机设置
2. 进入：设置 → 电池 → AutoJs6
3. 选择"不限制"或"无限制"
4. 部分手机还需要：设置 → 应用 → AutoJs6 → 省电策略 → 无限制

**悬浮窗权限（可选，用于查看日志）**
1. 打开手机设置
2. 进入：设置 → 应用 → 特殊应用权限 → 显示在其他应用上层
3. 找到 AutoJs6 并开启

> 不同品牌手机的设置路径可能略有不同，请根据实际情况查找

### 5. 修改配置

1. 在 AutoJs6 中打开项目
2. 编辑 `config.js` 文件
3. 根据需要修改签到原因、触发时间等参数
4. 保存文件

### 6. 运行项目

- **自动签到**：运行 `main.js` 并保持后台
- **手动签到**：运行 `tools/manual-checkin.js`

## 项目结构

```
auto-workwx/
├── main.js                    # 自动签到（通知监听 + 备用定时）
├── config.js                  # 配置文件
├── project.json               # AutoJs6 项目配置
├── README.md                  # 说明文档
└── tools/
    ├── manual-checkin.js        # 手动签到（执行一次）
    └── analyze-screen.js        # 界面分析调试工具
```

## 锁屏设置

脚本运行时需要屏幕处于解锁状态。推荐方案：

### 方案一：禁用锁屏（推荐）

设置 → 安全 → 屏幕锁定 → 选择"无"

### 方案二：Smart Lock 信任场所

1. 设置 → 安全 → Smart Lock
2. 添加"信任的地点"（如宿舍、家）或“信任的蓝牙设备”等
3. 在信任地点或连接到信任设备时设备会自动保持解锁

## 配置

编辑 `config.js`：

```javascript
module.exports = {
    packageName: "com.tencent.wework",
    
    checkin: {
        reasonText: "离校"
    },
    
    fudaomao: {
        entryText: "辅导猫"
    },
    
    trigger: {
        keywords: ["打卡", "签到", "辅导猫"],
        startHour: 7,
        startMinute: 50,
        endHour: 8,
        endMinute: 10
    },
    
    fallback: {
        hour: 10,
        minute: 30
    }
};
```

### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `packageName` | string | `com.tencent.wework` | 企业微信包名，一般无需修改 |
| `checkin.reasonText` | string | `离校` | 范围外签到时自动填写的原因 |
| `fudaomao.entryText` | string | `辅导猫` | 企业微信工作台中辅导猫入口的文本 |
| `trigger.keywords` | array | `["打卡", "签到", "辅导猫"]` | 通知触发关键词，通知标题或内容包含任一关键词即触发 |
| `trigger.startHour` | number | `7` | 通知触发生效开始时间（小时，24小时制） |
| `trigger.startMinute` | number | `50` | 通知触发生效开始时间（分钟） |
| `trigger.endHour` | number | `8` | 通知触发生效结束时间（小时） |
| `trigger.endMinute` | number | `10` | 通知触发生效结束时间（分钟） |
| `fallback.hour` | number | `10` | 备用定时签到时间（小时），当通知触发时段内未签到时执行 |
| `fallback.minute` | number | `30` | 备用定时签到时间（分钟） |

### 触发逻辑

1. **通知触发**：在 `trigger.startHour:startMinute` 至 `trigger.endHour:endMinute` 时段内，收到企业微信通知且内容匹配 `keywords` 时自动签到
2. **备用定时**：如果通知触发时段内没有成功签到，则在 `fallback.hour:fallback.minute` 自动执行一次签到
3. 每天只会执行一次签到（通知触发或备用定时，先到先执行）

## 使用方式

### 方式一：自动签到（推荐）

自动签到通过通知触发和备用定时两种机制实现，确保不会漏签。

**启动步骤：**

1. 打开 AutoJs6
2. 进入项目目录 `auto-workwx`
3. 点击运行 `main.js`
4. 保持 AutoJs6 在后台运行

**运行后会看到：**

```
===== 辅导猫自动签到服务 =====
监听包名: com.tencent.wework
触发关键词: 打卡, 签到, 辅导猫
通知触发时段: 07:50 - 08:10
备用定时: 10:30 (如通知未触发)

监听中... (保持脚本运行)
```

**触发机制：**

1. **通知触发**（优先）
   - 时间：`07:50 - 08:10`（可在 config.js 修改）
   - 条件：收到企业微信通知，且标题或内容包含关键词（打卡/签到/辅导猫）
   - 触发后立即执行签到流程

2. **备用定时**（兜底）
   - 时间：`10:30`（可在 config.js 修改）
   - 条件：当天通知触发时段内没有成功签到
   - 确保即使错过通知也能完成签到

**注意事项：**

- 每天只会执行一次签到（通知触发或备用定时，先到先执行）
- 日期变更后自动重置，第二天继续监听
- 需要保持 AutoJs6 后台运行，建议关闭电池优化

### 方式二：手动签到

适用于测试或临时需要签到的场景。

**运行步骤：**

1. 打开 AutoJs6
2. 进入项目目录 `auto-workwx`
3. 进入 `tools` 文件夹
4. 点击运行 `manual-checkin.js`
5. 观察脚本执行流程

**运行后会看到：**

```
===== 手动签到 =====
>>> 杀掉企业微信后台...
>>> 启动企业微信...
>>> 点击: 辅导猫
>>> 今天: 02月20日
>>> 找到 3 个今日活动

===== 活动 1/3: 早签到 02月20日 =====
>>> 点击: 签到
>>> 签到成功！
>>> 返回

===== 结果汇总 =====
1. 早签到 02月20日 -> success
2. 午签到 02月20日 -> already_signed
3. 晚签到 02月20日 -> already_signed
=== 完成 ===
```

### 方式三：调试模式

当签到流程出现问题时，使用界面分析工具排查。

**运行步骤：**

1. 手动打开企业微信，进入辅导猫签到页面
2. 打开 AutoJs6
3. 进入 `tools` 文件夹
4. 运行 `analyze-screen.js`
5. 查看控制台输出的界面元素信息

**输出示例：**

```
===== 界面分析 =====
包名: com.tencent.wework
Activity: ...

[控件列表]
TextView: "签到" bounds(100,200,200,250) clickable=false
Button: "继续签到" bounds(50,500,350,550) clickable=true
...
```

根据输出信息调整脚本中的元素查找逻辑。

## 签到流程

```
唤醒屏幕 → 上滑解锁 → 杀掉企业微信 → 启动企业微信 → 进入辅导猫
    ↓
遍历今日活动 → 检查是否已签到 → 是 → 跳过
    ↓ 否
点击签到按钮 → 继续签到 → 去拍照 → 拍照 → 使用照片
    ↓
填写原因 → 收起键盘 → 完成签到 → 下一个活动
    ↓
输出结果汇总
```

## 注意事项

- 拍照时请遮挡摄像头（实现黑屏照片）
- 首次运行建议手动观察流程
- 如遇问题，使用 `tools/analyze-screen.js` 分析当前界面
- 脚本有 3 分钟全局超时保护

## License

MIT
