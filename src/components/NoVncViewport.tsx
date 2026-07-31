import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import RFB from '@novnc/novnc';
import { useT } from '../hooks/useT';

export type NoVncScaleMode = 'native' | 'fit' | 'stretch';
export type NoVncInputMode = 'touch' | 'mouse';

export type DisplayConnectionState =
  | 'waiting-runtime'
  | 'waiting-display'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unavailable';

export interface NoVncViewportHandle {
  sendText: (text: string) => void;
}

export interface NoVncCredentials {
  password: string;
}

type InternalRfb = RFB & {
  _sendMouse?: (x: number, y: number, mask: number) => void;
  showDotCursor?: boolean;
  dragViewport?: boolean;
};

const LEFT_BUTTON_MASK = 1 << 0;
const RIGHT_BUTTON_MASK = 1 << 2;
const WHEEL_UP_MASK = 1 << 3;
const WHEEL_DOWN_MASK = 1 << 4;
const WHEEL_LEFT_MASK = 1 << 5;
const WHEEL_RIGHT_MASK = 1 << 6;
const DOUBLE_TAP_WINDOW_MS = 320;
const TAP_MAX_DURATION_MS = 220;
const TWO_FINGER_TAP_MAX_MS = 260;
const TAP_MOVE_THRESHOLD = 8;
const SCROLL_STEP_PX = 44;
const CURSOR_SPEED = 1.12;
const INERTIA_THRESHOLD = 0.02;
const INERTIA_FRICTION = 0.92;

export const NoVncViewport = forwardRef<NoVncViewportHandle, {
  websocketPort?: number;
  websocketUrl?: string | null;
  password?: string;
  active: boolean;
  machineRunning?: boolean;
  className?: string;
  reconnectWindowMs?: number;
  initialDelayMs?: number;
  connectionKey?: number;
  onConnectionStateChange?: (state: DisplayConnectionState) => void;
  onCredentialsRequired?: () => Promise<NoVncCredentials | null>;
  onSecurityFailure?: () => void;
  scaleMode?: NoVncScaleMode;
  inputMode?: NoVncInputMode;
}>(function NoVncViewportInner({
  websocketPort,
  websocketUrl,
  password = '',
  active,
  machineRunning = active,
  className = '',
  reconnectWindowMs = 15000,
  initialDelayMs = 0,
  connectionKey = 0,
  onConnectionStateChange,
  onCredentialsRequired,
  onSecurityFailure,
  scaleMode = 'fit',
  inputMode = 'touch'
}, ref) {
  const t = useT();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gestureLayerRef = useRef<HTMLDivElement | null>(null);
  const rfbRef = useRef<RFB | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const originalAbsRef = useRef<{ x?: (x: number) => number; y?: (y: number) => number }>({});
  const reconnectTimerRef = useRef<number | null>(null);
  const initialDelayTimerRef = useRef<number | null>(null);
  const reconnectStartedAtRef = useRef<number | null>(null);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const onCredentialsRequiredRef = useRef(onCredentialsRequired);
  const onSecurityFailureRef = useRef(onSecurityFailure);
  const inputModeRef = useRef<NoVncInputMode>(inputMode);
  const renderFrameRef = useRef<number | null>(null);
  const inertiaFrameRef = useRef<number | null>(null);
  const cursorInitializedRef = useRef(false);
  const cursorPosRef = useRef({ x: 0, y: 0 });
  const cursorVelocityRef = useRef({ x: 0, y: 0 });
  const cursorButtonMaskRef = useRef(0);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const gestureRef = useRef({
    kind: 'idle' as 'idle' | 'single' | 'dragging' | 'twofinger',
    startTime: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    holdTimer: null as number | null,
    doubleTap: false,
    lastMoveTime: 0,
    scrollX: 0,
    scrollY: 0,
    rightTapCandidate: false
  });
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [displayReady, setDisplayReady] = useState(false);
  const [connectionState, setConnectionState] = useState<DisplayConnectionState>('waiting-runtime');
  const [cursorView, setCursorView] = useState({
    x: 0,
    y: 0,
    visible: false,
    dragging: false
  });

  function scheduleCursorRender() {
    if (renderFrameRef.current != null) {
      return;
    }
    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null;
      setCursorView((current) => {
        const nextVisible = inputModeRef.current === 'mouse' && connectionState === 'connected';
        const nextDragging = cursorButtonMaskRef.current === LEFT_BUTTON_MASK;
        const next = {
          x: cursorPosRef.current.x,
          y: cursorPosRef.current.y,
          visible: nextVisible,
          dragging: nextDragging
        };
        if (
          Math.abs(current.x - next.x) < 0.01 &&
          Math.abs(current.y - next.y) < 0.01 &&
          current.visible === next.visible &&
          current.dragging === next.dragging
        ) {
          return current;
        }
        return next;
      });
    });
  }

  function getViewportRect() {
    return gestureLayerRef.current?.getBoundingClientRect() ?? mountRef.current?.getBoundingClientRect() ?? null;
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function stopInertia() {
    if (inertiaFrameRef.current != null) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  }

  function clearHoldTimer() {
    if (gestureRef.current.holdTimer != null) {
      window.clearTimeout(gestureRef.current.holdTimer);
      gestureRef.current.holdTimer = null;
    }
  }

  function resetGesture() {
    clearHoldTimer();
    gestureRef.current.kind = 'idle';
    gestureRef.current.startTime = 0;
    gestureRef.current.lastX = 0;
    gestureRef.current.lastY = 0;
    gestureRef.current.lastMoveTime = 0;
    gestureRef.current.moved = false;
    gestureRef.current.doubleTap = false;
    gestureRef.current.scrollX = 0;
    gestureRef.current.scrollY = 0;
    gestureRef.current.rightTapCandidate = false;
  }

  function centerCursor() {
    const rect = getViewportRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }
    cursorPosRef.current = {
      x: rect.width / 2,
      y: rect.height / 2
    };
    cursorInitializedRef.current = true;
    scheduleCursorRender();
  }

  function clampCursorToViewport() {
    const rect = getViewportRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }
    if (!cursorInitializedRef.current) {
      centerCursor();
      return;
    }
    cursorPosRef.current = {
      x: clamp(cursorPosRef.current.x, 0, rect.width),
      y: clamp(cursorPosRef.current.y, 0, rect.height)
    };
    scheduleCursorRender();
  }

  function getCanvasPoint() {
    const mountRect = mountRef.current?.getBoundingClientRect();
    const canvas = mountRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    const canvasRect = canvas?.getBoundingClientRect() ?? mountRect;
    if (!mountRect || !canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) {
      return null;
    }
    const clientX = mountRect.left + cursorPosRef.current.x;
    const clientY = mountRect.top + cursorPosRef.current.y;
    return {
      x: clamp(clientX - canvasRect.left, 0, canvasRect.width),
      y: clamp(clientY - canvasRect.top, 0, canvasRect.height)
    };
  }

  function sendMouse(mask: number) {
    const rfb = rfbRef.current as InternalRfb | null;
    if (!rfb?._sendMouse) {
      return;
    }
    const point = getCanvasPoint();
    if (!point) {
      return;
    }
    rfb._sendMouse(point.x, point.y, mask);
  }

  function pulseMouse(mask: number) {
    sendMouse(mask);
    sendMouse(0);
  }

  function moveCursorBy(deltaX: number, deltaY: number, emitMouse = true, updateVelocity = true, deltaTimeMs = 16) {
    const rect = getViewportRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return;
    }
    if (!cursorInitializedRef.current) {
      centerCursor();
    }
    const nextX = clamp(cursorPosRef.current.x + deltaX, 0, rect.width);
    const nextY = clamp(cursorPosRef.current.y + deltaY, 0, rect.height);
    const appliedDeltaX = nextX - cursorPosRef.current.x;
    const appliedDeltaY = nextY - cursorPosRef.current.y;

    cursorPosRef.current = {
      x: nextX,
      y: nextY
    };

    if (updateVelocity && deltaTimeMs > 0) {
      cursorVelocityRef.current = {
        x: appliedDeltaX / deltaTimeMs,
        y: appliedDeltaY / deltaTimeMs
      };
    }

    scheduleCursorRender();
    if (emitMouse) {
      sendMouse(cursorButtonMaskRef.current);
    }
  }

  function beginDrag() {
    if (cursorButtonMaskRef.current === LEFT_BUTTON_MASK) {
      return;
    }
    cursorButtonMaskRef.current = LEFT_BUTTON_MASK;
    gestureRef.current.kind = 'dragging';
    scheduleCursorRender();
    sendMouse(cursorButtonMaskRef.current);
  }

  function releaseDrag() {
    if (cursorButtonMaskRef.current === 0) {
      return;
    }
    cursorButtonMaskRef.current = 0;
    scheduleCursorRender();
    sendMouse(0);
  }

  function startInertia() {
    stopInertia();
    const step = () => {
      const velocityX = cursorVelocityRef.current.x;
      const velocityY = cursorVelocityRef.current.y;
      if (Math.abs(velocityX) < INERTIA_THRESHOLD && Math.abs(velocityY) < INERTIA_THRESHOLD) {
        cursorVelocityRef.current = { x: 0, y: 0 };
        inertiaFrameRef.current = null;
        return;
      }
      moveCursorBy(velocityX * 16, velocityY * 16, true, false);
      cursorVelocityRef.current = {
        x: velocityX * INERTIA_FRICTION,
        y: velocityY * INERTIA_FRICTION
      };
      inertiaFrameRef.current = window.requestAnimationFrame(step);
    };
    inertiaFrameRef.current = window.requestAnimationFrame(step);
  }

  function syncInputModeState() {
    const rfb = rfbRef.current as InternalRfb | null;
    if (rfb) {
      rfb.showDotCursor = false;
      rfb.dragViewport = false;
    }
    if (!active || !machineRunning || connectionState !== 'connected' || inputModeRef.current !== 'mouse') {
      stopInertia();
      clearHoldTimer();
      releaseDrag();
      scheduleCursorRender();
      return;
    }
    clampCursorToViewport();
    scheduleCursorRender();
  }

  const url = useMemo(() => {
    if (websocketUrl) {
      return websocketUrl;
    }
    if (!websocketPort) {
      return null;
    }
    if (window.location.protocol === 'file:') {
      return `ws://127.0.0.1:${websocketPort}`;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/novnc?port=${encodeURIComponent(String(websocketPort))}`;
  }, [websocketPort, websocketUrl]);

  function applyViewportScale(rfb: RFB) {
    const target = mountRef.current;
    if (!target) return;

    const display = (rfb as RFB & {
      _display?: {
        _viewportLoc?: { w: number; h: number; x: number; y: number };
        scale?: number;
        absX?: (x: number) => number;
        absY?: (y: number) => number;
        viewportChangeSize?: (w: number, h: number) => void;
        resize?: (w: number, h: number) => void;
      };
      _screen?: HTMLDivElement;
    })._display;
    const screen = (rfb as RFB & { _screen?: HTMLDivElement })._screen;

    if (!display?._viewportLoc) return;
    originalAbsRef.current.x ??= display.absX;
    originalAbsRef.current.y ??= display.absY;

    const rect = target.getBoundingClientRect();
    const viewportWidth = display._viewportLoc.w || 0;
    const viewportHeight = display._viewportLoc.h || 0;

    if (viewportWidth <= 0 || viewportHeight <= 0 || rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const scaleX = rect.width / viewportWidth;
    const scaleY = rect.height / viewportHeight;

    if (scaleMode === 'fit') {
      rfb.scaleViewport = true;
      if (originalAbsRef.current.x) display.absX = originalAbsRef.current.x;
      if (originalAbsRef.current.y) display.absY = originalAbsRef.current.y;
      if (screen) {
        screen.style.alignItems = 'center';
        screen.style.justifyContent = 'center';
        screen.style.overflow = 'hidden';
      }
      return;
    }

    rfb.scaleViewport = false;

    const canvas = target.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    if (scaleMode === 'native') {
      if (originalAbsRef.current.x) display.absX = originalAbsRef.current.x;
      if (originalAbsRef.current.y) display.absY = originalAbsRef.current.y;
      display.scale = 1;
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      if (screen) {
        screen.style.alignItems = 'center';
        screen.style.justifyContent = 'center';
        screen.style.overflow = 'auto';
      }
      return;
    }

    display.scale = scaleX;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    display.absX = (x: number) => Math.trunc(x / scaleX + (display._viewportLoc?.x ?? 0));
    display.absY = (y: number) => Math.trunc(y / scaleY + (display._viewportLoc?.y ?? 0));
    if (screen) {
      screen.style.alignItems = 'stretch';
      screen.style.justifyContent = 'stretch';
      screen.style.overflow = 'hidden';
    }

    if (inputModeRef.current === 'mouse') {
      clampCursorToViewport();
    }
  }

  useEffect(() => {
    onConnectionStateChangeRef.current = onConnectionStateChange;
  }, [onConnectionStateChange]);

  useEffect(() => {
    onCredentialsRequiredRef.current = onCredentialsRequired;
  }, [onCredentialsRequired]);

  useEffect(() => {
    onSecurityFailureRef.current = onSecurityFailure;
  }, [onSecurityFailure]);

  useEffect(() => {
    onConnectionStateChangeRef.current?.(connectionState);
  }, [connectionState]);

  useEffect(() => {
    setConnectionAttempt(0);
    setDisplayReady(false);
    reconnectStartedAtRef.current = null;

    if (initialDelayTimerRef.current != null) {
      window.clearTimeout(initialDelayTimerRef.current);
      initialDelayTimerRef.current = null;
    }

    if (!active || !machineRunning || !url) {
      setConnectionState(machineRunning ? 'waiting-display' : 'waiting-runtime');
      return;
    }

    setConnectionState(initialDelayMs > 0 ? 'waiting-display' : 'connecting');
    initialDelayTimerRef.current = window.setTimeout(() => {
      setDisplayReady(true);
    }, initialDelayMs);

    return () => {
      if (initialDelayTimerRef.current != null) {
        window.clearTimeout(initialDelayTimerRef.current);
        initialDelayTimerRef.current = null;
      }
    };
  }, [active, initialDelayMs, machineRunning, url]);

  useEffect(() => {
    const target = mountRef.current;
    if (!active || !machineRunning || !displayReady || !target || !url) {
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (rfbRef.current) {
        rfbRef.current.disconnect();
        rfbRef.current = null;
      }
      return;
    }

    let disposed = false;
    let credentialsRequestPending = false;
    let securityFailed = false;
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    target.replaceChildren();
    setConnectionState(connectionAttempt > 0 ? 'reconnecting' : 'connecting');

    let rfb: RFB;
    try {
      rfb = new RFB(target, url, {
        credentials: password ? { password } : undefined,
        shared: true
      });
    } catch {
      setConnectionState('unavailable');
      return () => undefined;
    }
    rfb.viewOnly = false;
    rfb.scaleViewport = scaleMode === 'fit';
    rfb.resizeSession = false;
    (rfb as InternalRfb).showDotCursor = false;
    (rfb as InternalRfb).dragViewport = false;
    rfb.background = getComputedStyle(document.documentElement).getPropertyValue('--console-surface').trim() || '#1c1724';
    rfb.clipViewport = false;
    rfb.qualityLevel = 6;
    rfb.compressionLevel = 2;
    rfbRef.current = rfb;

    const handleConnect = () => {
      if (disposed) return;
      reconnectStartedAtRef.current = null;
      applyViewportScale(rfb);
      syncInputModeState();
      setConnectionState('connected');
    };

    const handleDisconnect = (event: Event) => {
      if (disposed) return;
      if (securityFailed) {
        setConnectionState('unavailable');
        return;
      }
      const detail = (event as CustomEvent<{ clean?: boolean }>).detail;
      const now = Date.now();
      if (reconnectStartedAtRef.current == null) {
        reconnectStartedAtRef.current = now;
      }
      const elapsed = now - reconnectStartedAtRef.current;

      if (elapsed >= reconnectWindowMs) {
        setConnectionState('unavailable');
        return;
      }

      setConnectionState('reconnecting');
      reconnectTimerRef.current = window.setTimeout(() => {
        if (!disposed) {
          setConnectionAttempt((attempt) => attempt + 1);
        }
      }, detail?.clean ? 500 : 900);
    };

    const handleCredentialsRequired = async () => {
      if (disposed || credentialsRequestPending) return;
      if (password) {
        rfb.sendCredentials({ password });
        return;
      }
      const requestCredentials = onCredentialsRequiredRef.current;
      if (!requestCredentials) {
        setConnectionState('unavailable');
        return;
      }
      credentialsRequestPending = true;
      try {
        const credentials = await requestCredentials();
        if (!disposed && credentials?.password) {
          rfb.sendCredentials(credentials);
        }
      } finally {
        credentialsRequestPending = false;
      }
    };

    const handleSecurityFailure = () => {
      if (disposed) return;
      securityFailed = true;
      setConnectionState('unavailable');
      onSecurityFailureRef.current?.();
    };

    rfb.addEventListener('connect', handleConnect);
    rfb.addEventListener('disconnect', handleDisconnect);
    rfb.addEventListener('credentialsrequired', handleCredentialsRequired);
    rfb.addEventListener('securityfailure', handleSecurityFailure);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => {
        applyViewportScale(rfb);
        clampCursorToViewport();
      });
      resizeObserverRef.current.observe(target);
    }

    return () => {
      disposed = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      rfb.removeEventListener('connect', handleConnect);
      rfb.removeEventListener('disconnect', handleDisconnect);
      rfb.removeEventListener('credentialsrequired', handleCredentialsRequired);
      rfb.removeEventListener('securityfailure', handleSecurityFailure);
      rfb.disconnect();
      if (rfbRef.current === rfb) {
        rfbRef.current = null;
      }
    };
  }, [active, connectionAttempt, connectionKey, displayReady, machineRunning, password, reconnectWindowMs, url]);

  // Apply scale mode to noVNC canvas
  useEffect(() => {
    const rfb = rfbRef.current;
    if (!rfb) return;
    rfb.scaleViewport = scaleMode === 'fit';
    rfb.resizeSession = false;
    applyViewportScale(rfb);
  }, [scaleMode]);

  useEffect(() => {
    inputModeRef.current = inputMode;
    syncInputModeState();
  }, [active, connectionState, inputMode, machineRunning]);

  useEffect(() => () => {
    stopInertia();
    if (renderFrameRef.current != null) {
      window.cancelAnimationFrame(renderFrameRef.current);
      renderFrameRef.current = null;
    }
    resetGesture();
  }, []);

  // Expose sendText method via ref
  useImperativeHandle(ref, () => ({
    sendText: (text: string) => {
      const rfb = rfbRef.current;
      if (!rfb) return;

      // Helper to convert character to X11 keysym
      const charToKeysym = (char: string): number => {
        const code = char.charCodeAt(0);
        // Printable ASCII maps directly to keysym
        if (code >= 0x20 && code <= 0x7E) {
          return code;
        }
        // Newline / Return
        if (char === '\n' || char === '\r') {
          return 0xFF0D; // XK_Return
        }
        // Tab
        if (char === '\t') {
          return 0xFF09; // XK_Tab
        }
        // Backspace
        if (char === '\b') {
          return 0xFF08; // XK_BackSpace
        }
        // For other Unicode, use the codepoint directly (basic multilingual plane)
        return code;
      };

      // Send each character as keydown + keyup
      for (const char of text) {
        const keysym = charToKeysym(char);
        (rfb as RFB & { sendKey: (keysym: number, code: number, down: boolean) => void }).sendKey(keysym, 0, true);
        (rfb as RFB & { sendKey: (keysym: number, code: number, down: boolean) => void }).sendKey(keysym, 0, false);
      }
    }
  }), []);

  function handleGestureTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (inputModeRef.current !== 'mouse') {
      return;
    }
    event.preventDefault();
    stopInertia();

    const now = Date.now();
    if (!cursorInitializedRef.current) {
      centerCursor();
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const lastTap = lastTapRef.current;
      const doubleTap = lastTap != null && now - lastTap.time <= DOUBLE_TAP_WINDOW_MS;
      gestureRef.current.kind = doubleTap ? 'dragging' : 'single';
      gestureRef.current.startTime = now;
      gestureRef.current.lastX = touch.clientX;
      gestureRef.current.lastY = touch.clientY;
      gestureRef.current.lastMoveTime = now;
      gestureRef.current.moved = false;
      gestureRef.current.doubleTap = doubleTap;
      gestureRef.current.scrollX = 0;
      gestureRef.current.scrollY = 0;
      gestureRef.current.rightTapCandidate = false;

      if (doubleTap) {
        beginDrag();
        return;
      }
      return;
    }

    if (event.touches.length >= 2) {
      clearHoldTimer();
      releaseDrag();
      const first = event.touches[0];
      const second = event.touches[1];
      gestureRef.current.kind = 'twofinger';
      gestureRef.current.startTime = now;
      gestureRef.current.lastX = (first.clientX + second.clientX) / 2;
      gestureRef.current.lastY = (first.clientY + second.clientY) / 2;
      gestureRef.current.lastMoveTime = now;
      gestureRef.current.moved = false;
      gestureRef.current.doubleTap = false;
      gestureRef.current.scrollX = 0;
      gestureRef.current.scrollY = 0;
      gestureRef.current.rightTapCandidate = true;
    }
  }

  function handleGestureTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    if (inputModeRef.current !== 'mouse') {
      return;
    }
    event.preventDefault();
    const now = Date.now();

    if ((gestureRef.current.kind === 'single' || gestureRef.current.kind === 'dragging') && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = (touch.clientX - gestureRef.current.lastX) * CURSOR_SPEED;
      const deltaY = (touch.clientY - gestureRef.current.lastY) * CURSOR_SPEED;
      const deltaTimeMs = Math.max(1, now - gestureRef.current.lastMoveTime);
      gestureRef.current.lastX = touch.clientX;
      gestureRef.current.lastY = touch.clientY;
      gestureRef.current.lastMoveTime = now;
      if (Math.abs(deltaX) > TAP_MOVE_THRESHOLD || Math.abs(deltaY) > TAP_MOVE_THRESHOLD) {
        gestureRef.current.moved = true;
        clearHoldTimer();
      }
      moveCursorBy(deltaX, deltaY, true, true, deltaTimeMs);
      return;
    }

    if (gestureRef.current.kind === 'twofinger' && event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      const centerX = (first.clientX + second.clientX) / 2;
      const centerY = (first.clientY + second.clientY) / 2;
      const deltaX = centerX - gestureRef.current.lastX;
      const deltaY = centerY - gestureRef.current.lastY;
      gestureRef.current.lastX = centerX;
      gestureRef.current.lastY = centerY;

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        gestureRef.current.moved = true;
        gestureRef.current.rightTapCandidate = false;
      }

      gestureRef.current.scrollX += deltaX;
      gestureRef.current.scrollY += deltaY;

      while (gestureRef.current.scrollY <= -SCROLL_STEP_PX) {
        pulseMouse(WHEEL_UP_MASK);
        gestureRef.current.scrollY += SCROLL_STEP_PX;
      }
      while (gestureRef.current.scrollY >= SCROLL_STEP_PX) {
        pulseMouse(WHEEL_DOWN_MASK);
        gestureRef.current.scrollY -= SCROLL_STEP_PX;
      }
      while (gestureRef.current.scrollX <= -SCROLL_STEP_PX) {
        pulseMouse(WHEEL_LEFT_MASK);
        gestureRef.current.scrollX += SCROLL_STEP_PX;
      }
      while (gestureRef.current.scrollX >= SCROLL_STEP_PX) {
        pulseMouse(WHEEL_RIGHT_MASK);
        gestureRef.current.scrollX -= SCROLL_STEP_PX;
      }
    }
  }

  function finishPointerGesture(cancelled: boolean) {
    const now = Date.now();
    const { kind, startTime, moved, rightTapCandidate } = gestureRef.current;
    clearHoldTimer();

    if (kind === 'single') {
      if (!cancelled && !moved && now - startTime <= TAP_MAX_DURATION_MS) {
        pulseMouse(LEFT_BUTTON_MASK);
        lastTapRef.current = { time: now, x: cursorPosRef.current.x, y: cursorPosRef.current.y };
      } else if (!cancelled) {
        startInertia();
      }
      resetGesture();
      return;
    }

    if (kind === 'dragging') {
      releaseDrag();
      if (!cancelled) {
        startInertia();
      }
      resetGesture();
      return;
    }

    if (kind === 'twofinger') {
      if (!cancelled && rightTapCandidate && !moved && now - startTime <= TWO_FINGER_TAP_MAX_MS) {
        pulseMouse(RIGHT_BUTTON_MASK);
      }
      resetGesture();
      return;
    }

    resetGesture();
  }

  return (
    <div className={['novnc-viewport', className, `novnc-viewport--${scaleMode}`].filter(Boolean).join(' ')}>
      <div
        ref={mountRef}
        className={[
          'novnc-viewport__mount',
          inputMode === 'mouse' ? 'novnc-viewport__mount--mouse' : ''
        ].filter(Boolean).join(' ')}
      />
      <div
        ref={gestureLayerRef}
        className={[
          'novnc-viewport__gesture-layer',
          inputMode === 'mouse' && connectionState === 'connected' ? 'novnc-viewport__gesture-layer--active' : ''
        ].filter(Boolean).join(' ')}
        onTouchStart={handleGestureTouchStart}
        onTouchMove={handleGestureTouchMove}
        onTouchEnd={(event) => {
          event.preventDefault();
          finishPointerGesture(false);
        }}
        onTouchCancel={(event) => {
          event.preventDefault();
          finishPointerGesture(true);
        }}
      >
        <div
          className={[
            'novnc-viewport__cursor',
            cursorView.visible ? 'novnc-viewport__cursor--visible' : '',
            cursorView.dragging ? 'novnc-viewport__cursor--dragging' : ''
          ].filter(Boolean).join(' ')}
          style={{
            transform: `translate(${cursorView.x}px, ${cursorView.y}px)`
          }}
        />
      </div>
      {connectionState !== 'connected' && (
        <div className="novnc-viewport__overlay" data-state={connectionState}>
          <span className="novnc-viewport__status">
            {connectionState === 'waiting-runtime' || connectionState === 'waiting-display'
              ? t('console.waitingConnection')
              : connectionState === 'connecting'
                ? t('console.liveDisplayConnecting')
                : connectionState === 'reconnecting'
                  ? t('console.liveDisplayReconnecting')
                  : t('console.liveDisplayUnavailable')}
          </span>
        </div>
      )}
    </div>
  );
});
