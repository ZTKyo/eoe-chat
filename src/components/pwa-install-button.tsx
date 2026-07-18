"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallMode =
  | "hidden"
  | "promptable"
  | "ios"
  | "unsupported";

type DialogKind = "ios" | "unsupported" | null;

function detectIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const isWebkit = /webkit/i.test(ua);
  const isNotChrome = !/crios/i.test(ua);
  const isNotFirefox = !/fxios/i.test(ua);
  return isWebkit && isNotChrome && isNotFirefox;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  // iOS Safari standalone
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return Boolean(navigatorWithStandalone.standalone);
}

function isLikelySupportedBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Chrome, Edge, Safari (desktop or iOS), and Android Chrome are likely fine.
  if (/chrome|edg|opera/i.test(ua)) return true;
  if (/safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua)) return true;
  return false;
}

function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /micromessenger|wechat|line|fbav|instagram|snapchat|inapp|twitter/i.test(ua);
}

function computeInitialMode(): InstallMode {
  if (isStandaloneDisplay()) return "hidden";
  if (detectIosSafari()) return "ios";
  if (typeof navigator !== "undefined" && !("serviceWorker" in navigator)) return "unsupported";
  return "unsupported";
}

export function PwaInstallButton() {
  const [mode, setMode] = useState<InstallMode>(computeInitialMode);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);

  useEffect(() => {
    if (mode === "hidden") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferred(promptEvent);
      setMode("promptable");
    };

    const onAppInstalled = () => {
      setDeferred(null);
      setMode("hidden");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [mode]);

  const handlePromptClick = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setMode("hidden");
      }
      setDeferred(null);
      if (choice.outcome === "dismissed") {
        // Keep button visible; user may change their mind later. We do NOT auto re-prompt.
      }
    } catch {
      // Swallow; never expose internal errors or secrets.
    }
  };

  const handleSecondaryClick = () => {
    setDialog(detectIosSafari() ? "ios" : "unsupported");
  };

  const closeDialog = () => setDialog(null);

  if (mode === "hidden") return null;

  if (mode === "promptable") {
    return (
      <>
        <button
          type="button"
          data-testid="pwa-install-button"
          aria-label="安装 EOE Chat 到设备"
          onClick={handlePromptClick}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line-strong)] bg-white text-[12px] font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(20,30,35,0.03)] transition hover:border-[#bec7ca] hover:bg-[#fbfcfc]"
        >
          <Download size={14} aria-hidden="true" />
          安装 EOE Chat
        </button>
        {dialog ? <InstallDialog kind={dialog} onClose={closeDialog} /> : null}
      </>
    );
  }

  // iOS Safari or unsupported: show a "how to install" entry.
  return (
    <>
      <button
        type="button"
        data-testid="pwa-install-button"
        aria-label="了解如何安装 EOE Chat"
        onClick={handleSecondaryClick}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--line-strong)] bg-white text-[12px] font-medium text-[var(--text)] shadow-[0_1px_2px_rgba(20,30,35,0.03)] transition hover:border-[#bec7ca] hover:bg-[#fbfcfc]"
      >
        <Download size={14} aria-hidden="true" />
        安装 EOE Chat
      </button>
      {dialog ? <InstallDialog kind={dialog} onClose={closeDialog} /> : null}
    </>
  );
}

interface InstallDialogProps {
  kind: Exclude<DialogKind, null>;
  onClose: () => void;
}

function InstallDialog({ kind, onClose }: InstallDialogProps) {
  const inApp = isInAppBrowser();
  const supported = isLikelySupportedBrowser();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="安装 EOE Chat 说明"
      data-testid="pwa-install-dialog"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[0_18px_60px_rgba(30,43,47,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">安装 EOE Chat</h2>
          <button
            type="button"
            aria-label="关闭安装说明"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-black/5"
          >
            <X size={16} />
          </button>
        </div>

        {kind === "ios" ? (
          <ol className="space-y-2 text-[13px] leading-6 text-[var(--text)]">
            <li className="flex gap-2">
              <Share size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <span>点击 Safari 底部的分享按钮。</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 inline-block min-w-5 text-[var(--muted)]">2.</span>
              <span>选择“添加到主屏幕”。</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 inline-block min-w-5 text-[var(--muted)]">3.</span>
              <span>点击“添加”，桌面会出现 EOE Chat 图标。</span>
            </li>
          </ol>
        ) : (
          <div className="space-y-2 text-[13px] leading-6 text-[var(--text)]">
            <p>当前浏览器可能不支持直接安装 PWA。</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>推荐使用 Chrome、Edge 或 Safari 打开本页面。</li>
              <li>微信、Codex 等内置浏览器通常不支持安装。</li>
              <li>在系统浏览器中打开后，再点击浏览器的安装入口。</li>
            </ul>
            {inApp ? (
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                检测到内置浏览器，请复制当前链接到系统浏览器打开。
              </p>
            ) : null}
            {!supported ? (
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                当前浏览器不在支持列表内，安装入口可能不可见。
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
