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
- 每个运行实例内按 IP 进行简单频率限制
- `X-Silicon` 请求头、短时随机数和编码载荷校验

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

## 部署到 Cloudflare Pages

推荐使用 Cloudflare Pages 的 GitHub 集成。连接成功后，每次推送到生产分支都会自动构建和部署。

### 1. 推送代码到 GitHub

确认仓库中不包含 `.dev.vars`，然后将代码推送到 GitHub。

本项目仓库地址：<https://github.com/senzi/retro-ai-phone>

### 2. 创建 Pages 项目

1. 登录 Cloudflare Dashboard。
2. 打开 **Workers & Pages**。
3. 选择 **Create application → Pages → Connect to Git**。
4. 授权 GitHub，并选择 `senzi/retro-ai-phone`。
5. 选择生产分支，通常为 `main`。

### 3. 设置构建参数

填写以下内容：

```text
Framework preset: Vue
Build command: npm run build
Build output directory: dist
Root directory: /
```

不需要单独配置 Functions 目录。Cloudflare Pages 会自动识别仓库根目录下的 `functions/`，并将 `functions/api/chat.ts` 部署为 `/api/chat`。

### 4. 配置生产密钥

进入 Pages 项目：

```text
Settings → Variables and Secrets → Add
```

新增：

```text
Name: DEEPSEEK_API_KEY
Value: 你的 DeepSeek API Key
Type: Secret / Encrypt
```

生产环境必须配置。需要测试预览分支的 AI 对话时，也要为 Preview 环境配置同名 Secret。

保存后重新部署一次，使密钥绑定生效。

### 5. 验证部署

部署完成后打开 Cloudflare 提供的 `*.pages.dev` 地址，检查：

1. 页面、像素字体和 favicon 正常加载。
2. 新建会话后可以发送消息并收到 AI 回复。
3. 浏览器刷新后，有用户消息的历史会话仍然存在。
4. 直接向 `/api/chat` 发送普通 JSON 会得到 `X-Silicon` 校验失败，而网页内请求可以正常通过。

## 部署评估

当前版本已经满足 Cloudflare Pages 的基础部署条件：

- `npm run build` 可以生成 `dist/`
- Pages Function 可以通过 TypeScript 检查
- 前端使用相对路径调用 `/api/chat`，无需配置跨域
- API Key 只由服务端读取，不会打包进前端
- `.dev.vars`、Wrangler 本地状态和构建目录均不会提交
- 像素字体、离线词典和 favicon 均包含在构建产物中

需要注意：

- 当前限流使用 Function 实例内存，只适合轻量、防滥用的基础限制。Cloudflare 多实例之间不会共享计数；若必须严格保证每个用户每分钟两次，需要改用 Durable Objects 或集中式 KV/数据库方案。
- `X-Silicon` 用于阻止随手构造请求，但浏览器端算法可以被分析，不能替代账号认证、Turnstile 或服务端访问控制。
- 离线拼音词典会让前端压缩资源约为 760 KB，仍可正常部署到 Pages，但首次加载会比普通展示页稍大。
- 聊天历史保存在当前浏览器的 `localStorage`，不会跨设备同步，清理浏览器数据后会丢失。

## 项目结构

```text
src/
  components/       手机外壳、屏幕和键盘
  data/             离线拼音词典和许可文件
  input/            拼音与英文多击输入逻辑
  store/            手机、会话和导航状态
  utils/            请求编码逻辑
functions/
  api/chat.ts       Cloudflare Pages Function
public/
  fonts/            像素字体
  favicon.svg       网站图标
```

## 隐私与安全

- 会话记录只保存在浏览器本地。
- 只有用户实际发送过消息的会话才会保存。
- DeepSeek API Key 只应配置在 `.dev.vars` 或 Cloudflare Secret 中。
- 请勿将 `.dev.vars`、API Key 或 Cloudflare 凭据提交到 Git。

## 许可与致谢

项目使用 [MIT License](LICENSE)。

离线拼音词典来自 MIT 许可的 [simple-ime](https://github.com/nieyuyao/simple-ime)，对应许可文本保存在 `src/data/simple-ime-LICENSE.txt`。

像素字体许可文件随原始字体资源提供。
