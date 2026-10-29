# SPEC: 个人 AI Key 第一版

状态：active；2026-10-29。

- `GET /api/ai/settings`：认证后返回当前用户作用域、当前模型、默认 Key 是否配置，不返回密钥或网关地址；禁用缓存。本地 Demo 返回固定作用域。
- 各现有 AI POST 接受可选 `X-OfferPilot-AI-Key` 与 `X-OfferPilot-AI-User`；两者必须同时提供且用户作用域必须等于当前经过验证的账号。密钥为 1–512 个可打印 ASCII 字符，不含空格；无个人头时走现有环境配置。错误头返回 400/403，不尝试网关。
- 个人 Key 可附带可选 `X-OfferPilot-AI-Provider: qwen-payg`。服务端必须先验证用户作用域与 Key，再将该固定 ID 映射到 `https://cn-beijing.maas.qianwenaiapi.com/compatible-mode/v1`；不接收/转发客户端给出的任意 Base URL。缺少 provider Header 时沿用现有服务端网关，保持旧客户端及服务器默认 Key 兼容。`OPENAI_MODEL` 始终为服务端配置。
- 浏览器本地按用户作用域保存 Key；页面默认遮盖，允许用户查看、替换和删除。明文存储、无跨设备同步、可被同站脚本及浏览器扩展读取，须在界面说明。
- 浏览器另按用户作用域保存 provider ID，旧 Key 未选 provider 时默认服务器当前网关。个人 Key 仍不得降级为服务器 Key；所选固定 provider 只改变个人 Key 请求目标，不改变服务器默认调用路径。
- 所有返回体和日志不得包含 Key，网关失败不降级到默认 Key。AI 结构化输出保持非流式与 `enable_thinking: false`；不返回思考内容。
- `POST /api/ai/test-connection`：需登录（本地 Demo 除外）和 JSON Content-Type，接受同一可选个人 Key/账号请求头；不接受客户端模型或网关。使用现有配置请求最短的模型回复，最多一次、限时 12 秒；成功表示模型响应非空。失败返回脱敏的固定中文提示，不回传上游内容或密钥；不写训练数据。
