# FYP Spirit WebAR 第三方组件与授权说明

检查日期：2026-11-01。此文件记录实际引用的软件、许可证和仍需确认的来源；不替素材作者授予许可。许可证原文在 `licenses/`，公开发布本扫描页时应一同保留此文件及相关原文。

2026-11-02 M1～M4 更新：新增启动、性能保护、裁切召唤、资料/图鉴、照片合成及 XR 会话模块均为本项目新编写的集成代码；没有安装新库、付费 API、字体或网络美术。图鉴和独立 XR 实验页按需复用已经核对的 A-Frame 1.5.0 内的 Three.js r158 / GLTFLoader（MIT）。WebXR、Hit Test、可选 Anchors、Canvas、MediaStream 和本地存储是浏览器接口，不是额外复制的第三方 SDK。M1～M4 没有运行 Blender 转换、修改 FBX/.blend/生产 GLB，也没有安装人像分割模型。以下软件版本及原文继续保留；间接依赖与素材授权未确认项仍有效。

## 1. 网页实际使用的组件

| 组件 | 实际版本 / 用途 | 官方来源与许可证 | 随附原文 |
| --- | --- | --- | --- |
| A-Frame | 1.5.0，扫描页的场景框架 | https://github.com/aframevr/aframe/tree/v1.5.0 ，MIT | `licenses/aframe.txt` |
| super-three / Three.js | A-Frame 1.5.0 依赖 super-three 0.158.0；浏览器实测 THREE.REVISION=158，并非旧交接中的 r160+ | https://github.com/supermedium/three.js/tree/279e85ec0137b64c38caca24256fe6a0421d8e57 ，MIT；上游 https://github.com/mrdoob/three.js/tree/r158 | `licenses/super-three158.txt`、`licenses/three.txt` |
| aframe-extras | 7.0.0，animation-mixer | 页面使用历史 donmccurdy CDN 路径，现仓库 https://github.com/c-frame/aframe-extras/tree/v7.0.0 ，MIT | `licenses/extras.txt` |
| MindAR | 扫描运行时 1.2.5；Studio 编译器另引用 1.1.5（未升级） | https://github.com/hiukim/mind-ar-js/tree/v1.2.5 、https://github.com/hiukim/mind-ar-js/tree/v1.1.5 ，MIT | `licenses/mind.txt`、`licenses/mind115.txt` |
| Three.js（Studio 单独引用） | 0.128.0，工作台模型预览，与扫描页的 r158 是不同加载环境 | https://github.com/mrdoob/three.js/tree/r128 ，MIT | `licenses/three128.txt` |

实际 CDN 地址以 index.html、studio.html 为准。此次没有升级主版本，也没有把第三方整库代码复制进业务脚本。

## 2. 已识别的间接依赖与审核范围

MindAR 1.2.5 官方 package.json 声明的部分图像追踪相关依赖如下。版本带 `^` 是官方声明范围，**不等于已经证明 CDN bundle 内每一个模块的精确版本**。本项目没有可复现其整个 CDN 构建的依赖锁文件，因此下面不是完整 SBOM，也不是全部传递依赖的商业授权完成证明。

| 项目 | 官方声明范围 / 来源 | 许可证 / 原文 |
| --- | --- | --- |
| TensorFlow.js | ^4.16.0，https://github.com/tensorflow/tfjs | Apache-2.0，`licenses/tfjs.txt` |
| @msgpack/msgpack | ^2.8.0，https://github.com/msgpack/msgpack-javascript | ISC，`licenses/msgpack.txt` |
| mathjs | ^11.6.0，https://github.com/josdejong/mathjs | Apache-2.0，`licenses/mathjs.txt` |
| ml-matrix | ^6.10.4，https://github.com/mljs/matrix | MIT，`licenses/mlmatrix.txt` |
| svd-js | ^1.1.1，https://github.com/danilosalvati/svd-js | MIT，`licenses/svd.txt` |
| tinyqueue | ^2.0.3，https://github.com/mourner/tinyqueue | ISC，`licenses/tinyqueue.txt` |
| three-pathfinding | aframe-extras 声明 ^1.1.0，https://github.com/donmccurdy/three-pathfinding | MIT，`licenses/pathfinding.txt` |

已保留下载的完整许可证文字及其中版权人声明。MIT / ISC 允许使用、修改、公开分发及商业使用，通常要求保留版权、许可和免责文字；不要求把本项目自身代码开源。Apache-2.0 同样允许上述用途，另有专利条款、修改标记及适用的 NOTICE 保留要求；后续新增或打包其组件时还须检查该版本的 NOTICE 与其依赖。

## 3. 本地工具（不随扫描页执行）

- Blender 5.0.1：项目原有模型处理软件。本轮仅用独立后台进程只读检查已有 .blend，没有保存、导出或复制 Blender 源代码。官方 [COPYING](https://github.com/blender/blender/blob/v5.0.1/COPYING) 明确其采用 GNU GPL。GPL 涉及软件代码再分发义务，不能把它标为 MIT；本轮没有引入新的 GPL / AGPL 库。以后若要集成、分发 Blender 代码或插件，应另行审查；本次也不据此替模型和贴图确认授权。
- Pillow 12.2.0：本机已有，供 Python 读取图片和资产报告使用；安装包 LICENSE 标识 MIT-CMU，原文在 `licenses/Pillow.txt`。未将 Pillow 打包到手机网页。
- Project Nayuki QR Code generator：历史本地工具 `release/vendor/qrcodegen.py`，MIT，版权与完整许可证已保留在其源文件头部；官方 https://github.com/nayuki/QR-Code-generator 。本轮未改写、未向手机新增此库。
- Python、Node.js、已有 Chromium 仅用于本地检查，不随网页分发。本轮未下载新 npm 或 Python 依赖。

## 4. 仅评估、尚未安装或集成

| 工具 | 本轮核对的版本与来源 | 授权结论与限制 |
| --- | --- | --- |
| glTF-Transform | core package 4.5.1，评估快照 8e2a94a2616d293c4b503d0fb6a4b42e6ec7c62f；https://github.com/donmccurdy/glTF-Transform | MIT，Copyright (c) 2024 Don McCurdy，`licenses/gltf-transform.txt`。可修改、分发和商用，保留声明，无自身代码公开要求。未安装 CLI、Sharp 或其他编码器；未来须单独审计选用插件、编解码器及其依赖。 |
| meshoptimizer | JS package 1.3.0，评估快照 f0a684f11ead064e176775c9b796f82a55910e92；https://github.com/zeux/meshoptimizer | MIT，Copyright (c) 2016-2026 Arseny Kapoulkine，`licenses/meshoptimizer.txt`。可修改、分发和商用，保留声明，无自身代码公开要求。未安装、未注入解码器、未生成压缩生产模型。 |

上述 MIT 结论仅覆盖已检查仓库代码，不自动覆盖任意外部素材、可选原生工具或不同许可的依赖。几何细分和资源压缩是不同操作；采用这些工具也不会自动增加雕刻细节。

## 5. 仍未确认的来源

1. 原项目 OneEuroFilter 注释只有“GitHub 经典”，未提供原仓库、版本或版权说明。不能凭算法名称断言这段具体代码为 MIT；本轮保留已有实现，未复制新的外部实现。应补充最初来源或另行处理来源可证明的实现。
2. shisu_monster.glb、卡面、Textures 及 Blender 源文件未发现足以确认商业再分发权的素材授权文件。保留用户现有素材，不新增外来美术，不把“用户同意上传”解释成对所有上游素材版权的证明。
3. CDN 的全部构建依赖和可选模块尚未形成锁定版本清单。正式商业发布前需补齐，而不是把本次有限核对写成全部授权已清零。

本文件中第三方作者姓名、版权年份及许可证内的公开联系信息属于必要版权声明，不是用户的个人资料。
