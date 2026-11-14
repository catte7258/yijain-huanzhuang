# 一键换装

手机端优先的 H5 / PWA 试衣间，用来浏览并**一键切换** [RuiC-PoseAtlas](https://github.com/HRuiCcc/RuiC-PoseAtlas) 图鉴里的衣装参考。

本工具使用其公开图库，**不是**对该项目的换皮或再发行。应用名称是「一键换装」，页面里会标明：**素材来自 RuiC-PoseAtlas**。

> 本项目面向成年创作者，部分内容不适合未成年人。请遵守所在地法律法规与平台规范，未成年人请勿使用。

默认不展示内衣 / 性感 / 泳装分类，需要时在换装页打开「显示全部」。

## 本地运行

本应用是纯静态站点，无需构建、无框架依赖。请用本地静态服务器打开（直接双击 `index.html` 在部分浏览器里也能看界面，但 Service Worker / 添加到主屏幕不可用，且个别浏览器会限制本地脚本）。

在项目目录执行：

```bash
cd /workspace/dress-up
python3 -m http.server 8080
```

然后用手机或浏览器访问：

```
http://127.0.0.1:8080/
```

局域网里的手机访问时，把 `127.0.0.1` 换成这台电脑的局域网 IP 即可。也可以用其他静态服务器，例如 `npx serve .` 或 VS Code Live Server。

## 使用说明

底部四个标签：**换装** / **姿势** / **脸型** / **收藏**。

- **换装**是主界面。舞台上展示当前整套衣装大图（灰底原图完整放入深色试衣间，不裁掉鞋包）。点「随机换装」，或「上一套 / 下一套」，或在舞台上左右滑动，都会立刻换装，无需刷新。
- 默认筛选为日常分类：春 / 夏 / 秋 / 冬 / 派对。可按色系和标签 / 编号搜索。打开「显示全部」后才出现内衣、性感、泳装。
- 舞台上的姿势、脸型是**对照参考**，不会合成到衣服上（原图是 RGB 灰底、没有透明通道，无法把衣服贴到人台上）。
- 点姿势或脸型卡片会选中并回到换装页。收藏爱心、上次衣装、筛选和参考选择会保存在浏览器 `localStorage`。
- 「当前组合」提供官方图鉴深链接，可复制：
  - 姿势：`https://hruiccc.github.io/RuiC-PoseAtlas/#pose=<id>&angle=<angle>`
  - 衣装：`https://hruiccc.github.io/RuiC-PoseAtlas/costume.html#costume=<id>`
  - 脸型：`https://hruiccc.github.io/RuiC-PoseAtlas/face.html#portrait=<id>`（官方使用 `portrait` 参数，不是 `face`）

首次打开的默认衣装是 **SPR-0025**（春 · 象牙白连衣裙），默认姿势是标准全身站姿 `full_single_P018`（斜侧），默认脸型是短发 `f71f980dde3`。

可在支持的手机浏览器里「添加到主屏幕」，作为独立应用打开。

## 图片与数据

- 精简后的目录数据写在 `data/*.js` 里，随页面一起加载，**运行时不会再去跨域请求 JSON**。
- 衣装 / 姿势 / 脸型图片从官方 GitHub Pages 加载：
  - `https://hruiccc.github.io/RuiC-PoseAtlas/{thumb 或 image 路径}`
  - 脸部缩略图优先用仓库内 `portrait/thumbs/*.webp`；若失败再回退到 `https://ai-portrait-gallery.pages.dev/img/thumb/{id}.webp`
- 浏览缩略图采用懒加载，列表分页渲染，避免一次挂上全部 1,407 张图。
- Service Worker 只缓存应用壳（HTML / CSS / JS / 数据 / 图标），**不缓存**图鉴原图。离线时可打开界面和目录，但换装大图需要联网访问 CDN。
- 图片用 `<img src>` 引用官方 CDN，这不属于跨域 fetch，一般可正常显示。把 JSON 放到自己的页面里，是为了避免 `file://` 或跨域 `fetch` 被 CORS 拦住。

## 版权

- RuiC-PoseAtlas 的**源代码 / 样式 / 脚本 / 文档**以 [MIT License](https://github.com/HRuiCcc/RuiC-PoseAtlas/blob/main/LICENSE) 发布。
- **图片、原始数据与名称不在 MIT 许可范围内**，版权归原作者所有；禁止转售或再分发图片数据本身。请通过官方站点或 CDN 在线引用。
- 官方站点：[姿势](https://hruiccc.github.io/RuiC-PoseAtlas/) · [衣装](https://hruiccc.github.io/RuiC-PoseAtlas/costume.html) · [人像](https://hruiccc.github.io/RuiC-PoseAtlas/face.html) · [GitHub](https://github.com/HRuiCcc/RuiC-PoseAtlas)
