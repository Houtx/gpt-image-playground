# GPT Image Playground

一个基于 Next.js 的 OpenAI 图像模型 playground，支持使用 `gpt-image-2`、`gpt-image-1.5`、`gpt-image-1` 和 `gpt-image-1-mini` 进行图片生成、图片编辑、蒙版编辑、历史记录管理和费用估算。

> 默认模型为 `gpt-image-2`。该模型支持最高 4K 的自定义分辨率，本项目会在前端校验尺寸约束。

<p align="center">
  <img src="./readme-images/interface.jpg" alt="项目界面" width="600"/>
</p>

## 功能特性

- 图片生成：根据文本提示词生成新图片。
- 图片编辑：上传或粘贴源图片，通过提示词进行编辑。
- 内置蒙版工具：直接在图片上涂抹编辑区域，也可以上传 PNG 蒙版。
- 完整参数控制：支持模型、尺寸、质量、输出格式、压缩率、背景、审核强度、图片数量等参数。
- gpt-image-2 自定义分辨率：支持 2K/4K 预设和自定义宽高，并校验 16 倍数、最大边长、长宽比和总像素限制。
- 流式预览：生成过程中查看阶段性预览图。
- 历史记录：保存生成/编辑记录、参数、提示词、图片数量和费用估算。
- 费用统计：展示单次请求和历史总计的 token 用量与美元估算。
- 发送到编辑：可将生成结果或历史图片快速送入编辑模式。
- 剪贴板粘贴：编辑模式下可直接粘贴图片。
- 白天/黑夜主题：默认浅色主题，页面右上角可切换深色主题。
- 存储模式：支持服务端文件系统和浏览器 IndexedDB 两种图片存储方式。

## 本地运行

### 环境要求

- Node.js 20 或更高版本
- npm、yarn、pnpm 或 bun

### 1. 配置环境变量

在项目根目录创建 `.env.local`：

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
```

可选：配置访问密码。设置后，前端会在调用接口前要求输入密码。

```dotenv
APP_PASSWORD=your_password_here
```

可选：使用 OpenAI 兼容接口。

```dotenv
OPENAI_API_BASE_URL=your_compatible_api_endpoint_here
```

可选：配置图片存储模式。

```dotenv
# fs：保存到服务端 ./generated-images，适合本地运行
# indexeddb：图片以 base64 返回并保存到浏览器 IndexedDB，适合 Vercel 等无持久文件系统环境
NEXT_PUBLIC_IMAGE_STORAGE_MODE=fs
```

如果未设置 `NEXT_PUBLIC_IMAGE_STORAGE_MODE`，项目会在 Vercel 环境下自动使用 `indexeddb`，本地默认使用 `fs`。

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 使用项目。

### 4. 构建生产版本

```bash
npm run build
npm run start
```

## 部署到 Vercel

部署到 Vercel 时建议设置：

```dotenv
OPENAI_API_KEY=your_openai_api_key_here
APP_PASSWORD=your_password_here
NEXT_PUBLIC_IMAGE_STORAGE_MODE=indexeddb
```

如果从 `main` 或 `master` 分支部署，Vercel 生产环境通常会公开访问。建议为公开部署设置 `APP_PASSWORD`。

## 目录说明

- `src/app/page.tsx`：主页面状态和业务流程。
- `src/components/generation-form.tsx`：图片生成表单。
- `src/components/editing-form.tsx`：图片编辑和蒙版表单。
- `src/components/image-output.tsx`：图片输出预览。
- `src/components/history-panel.tsx`：历史记录和费用详情。
- `src/app/api/images/route.ts`：图像生成/编辑 API。
- `generated-images/`：本地文件系统模式下的图片输出目录。

## 注意事项

- OpenAI 图像模型可能需要组织完成验证后才能使用。
- 生成图片会产生 API 费用，请留意历史记录中的费用估算。
- 使用 `indexeddb` 模式时，图片保存在当前浏览器中；清理浏览器数据可能会删除图片。

## 许可证

MIT
