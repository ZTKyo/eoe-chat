# EOE Chat 私人 Beta 使用指南

## 在当前电脑使用

1. 双击项目根目录里的 `Start-Private-Beta.cmd`。
2. 等待窗口显示 `PRIVATE_TEXT_BETA_RUNNING`。
3. 浏览器打开窗口中显示的本机地址；默认是
   `http://127.0.0.1:3100`。
4. 像使用普通聊天助手一样自然聊天。
5. 不需要刻意测试英语，也不需要追求每次回复都出现 English Chunk。
6. 使用结束后，双击 `Stop-Private-Beta.cmd`。

双击 `Private-Beta-Status.cmd` 可以查看当前是否正在运行、端口、启动时间
和健康状态。

## 手机临时访问

只有在可信的私人局域网中才启用 LAN 模式。在项目目录打开 PowerShell，
运行：

```powershell
.\Start-Private-Beta.cmd -Lan
```

按启动窗口给出的局域网地址在手机浏览器中访问。不要在公共 Wi-Fi 使用，
不要开放公网端口，也不要配置路由器端口转发。脚本不会修改 Windows
Firewall；如果可信局域网设备仍无法访问，请停止服务，不要为了测试而放宽
公网安全设置。

## 记录真正影响体验的问题

不要保存每一条正常对话。只有普通回答错误、上下文丢失、用户前提被遗漏或
替换、English Chunk 明显生硬、Assistance 过于模板化等实际影响使用的问题，
才使用 `REAL_USE_FAILURE_TEMPLATE.md` 记录。
