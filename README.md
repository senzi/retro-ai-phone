# W810c AI Phone Simulator

一台运行在浏览器里的 2006 年功能机，以及住在 176 × 220 像素屏幕里的 2026 AI。

项目以 Sony Ericsson W810c 风格直板手机为灵感，保留小屏幕、九宫格键盘、方向键、短信容量和分页阅读等功能机交互，并通过 Cloudflare Pages Functions 接入 DeepSeek。

## 功能

- W810c 风格机身、LCD 扫描线、开机动画和动态时钟
- 待机、主菜单、AI 信息、拨号和设备信息页面
- 中文九宫格拼音、英文多击、数字和符号输入
- 5 万余条离线拼音数据，支持单字、词语、候选分页和本地词频学习
- AI 回复逐字显示，小屏幕方向键滚动阅读
- 多会话历史、本地缓存、删除确认和 100 条短信容量模拟
- 输入 `*#06#` 触发隐藏设备信息页面
- Cloudflare Pages Function 转发 LLM 请求

## 技术栈

- Vite
- Vue 3
- TypeScript
- Pinia
- Cloudflare Pages
- Cloudflare Pages Functions

## 操作方式

### 手机按键

- 方向键：移动、翻页或滚动
- 中间键：确认当前选项或候选词
- 右侧 OK：打开、确认或发送
- 左侧箭头：返回；待机页中进入拨号
- C：删除输入；历史页面中请求删除会话
- `2–9`：拼音或英文九宫格输入
- 长按 `#`：切换拼音、英文和数字模式
- 长按 `*`：打开符号表

拼音候选中，左右键逐项移动，上下键整页翻动，中间键确认。

### 桌面键盘

- `↑ ↓ ← →`：方向键
- `Enter`：确认
- `0–9`：数字按键
- `Backspace`：删除
- `Escape`：返回
- `#`：切换输入模式
- `*`：打开符号表或输入拨号码

## 本地开发

建议使用 Node.js 22。

安装依赖：

```bash
npm install
```

复制本地密钥文件：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

macOS 或 Linux：

```bash
cp .dev.vars.example .dev.vars
```

填写 DeepSeek API Key：

```dotenv
DEEPSEEK_API_KEY=你的_API_Key
```

`.dev.vars` 已加入 `.gitignore`，不要将真实密钥提交到仓库。

### 同时运行前后端

终端一持续构建前端：

```bash
npm run build -- --watch
```

终端二运行静态资源和 Pages Functions：

```bash
npx wrangler pages dev dist --port 8788
```

打开 `http://localhost:8788`。

单独运行 `npm run dev` 只会启动 Vite 前端，不会运行 `/api/chat` 对应的 Pages Function。

## 项目结构

```text
src/
  components/       手机外壳、屏幕和键盘
  data/             离线拼音词典和许可文件
  input/            拼音与英文多击输入逻辑
  store/            手机、会话和导航状态
functions/
  api/chat.ts       Cloudflare Pages Function
public/
  fonts/            像素字体
  favicon.svg       网站图标
```

## 数据与隐私

- 会话记录只保存在浏览器本地。
- 只有用户实际发送过消息的会话才会保存。
- DeepSeek API Key 只应配置在本地 `.dev.vars` 中。
- 请勿将 `.dev.vars` 或 API Key 提交到 Git。

## 许可与致谢

项目使用 [MIT License](LICENSE)。

离线拼音词典来自 MIT 许可的 [simple-ime](https://github.com/nieyuyao/simple-ime)，对应许可文本保存在 `src/data/simple-ime-LICENSE.txt`。

像素字体许可文件随原始字体资源提供。
