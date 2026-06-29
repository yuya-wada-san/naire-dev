import { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";

type BoxState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type DragType =
  | "move"
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

type DragState = {
  type: DragType;
  startX: number;
  startY: number;
  startBox: BoxState;
} | null;

type Props = {
  imageUrl: string;
  box: BoxState;
  onChange: (box: BoxState) => void;
  previewText?: string;
  fontColor?: string;
  fontSizePx?: number;
};

const MIN_SIZE = 2;
const HANDLE_SIZE = 10;

const HANDLES: Array<{ id: DragType; top: string; left: string; cursor: string }> = [
  { id: "nw", top: "0%", left: "0%", cursor: "nw-resize" },
  { id: "n", top: "0%", left: "50%", cursor: "n-resize" },
  { id: "ne", top: "0%", left: "100%", cursor: "ne-resize" },
  { id: "w", top: "50%", left: "0%", cursor: "w-resize" },
  { id: "e", top: "50%", left: "100%", cursor: "e-resize" },
  { id: "sw", top: "100%", left: "0%", cursor: "sw-resize" },
  { id: "s", top: "100%", left: "50%", cursor: "s-resize" },
  { id: "se", top: "100%", left: "100%", cursor: "se-resize" },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function applyDelta(
  type: DragType,
  startBox: BoxState,
  dx: number,
  dy: number,
): BoxState {
  let { top, left, width, height } = startBox;

  switch (type) {
    case "move":
      top = clamp(startBox.top + dy, 0, 100 - startBox.height);
      left = clamp(startBox.left + dx, 0, 100 - startBox.width);
      break;
    case "n": {
      const newTop = clamp(startBox.top + dy, 0, startBox.top + startBox.height - MIN_SIZE);
      top = newTop;
      height = startBox.height + startBox.top - newTop;
      break;
    }
    case "s":
      height = clamp(startBox.height + dy, MIN_SIZE, 100 - startBox.top);
      break;
    case "e":
      width = clamp(startBox.width + dx, MIN_SIZE, 100 - startBox.left);
      break;
    case "w": {
      const newLeft = clamp(startBox.left + dx, 0, startBox.left + startBox.width - MIN_SIZE);
      left = newLeft;
      width = startBox.width + startBox.left - newLeft;
      break;
    }
    case "ne": {
      const newTop = clamp(startBox.top + dy, 0, startBox.top + startBox.height - MIN_SIZE);
      top = newTop;
      height = startBox.height + startBox.top - newTop;
      width = clamp(startBox.width + dx, MIN_SIZE, 100 - startBox.left);
      break;
    }
    case "nw": {
      const newTop = clamp(startBox.top + dy, 0, startBox.top + startBox.height - MIN_SIZE);
      const newLeft = clamp(startBox.left + dx, 0, startBox.left + startBox.width - MIN_SIZE);
      top = newTop;
      height = startBox.height + startBox.top - newTop;
      left = newLeft;
      width = startBox.width + startBox.left - newLeft;
      break;
    }
    case "se":
      height = clamp(startBox.height + dy, MIN_SIZE, 100 - startBox.top);
      width = clamp(startBox.width + dx, MIN_SIZE, 100 - startBox.left);
      break;
    case "sw": {
      const newLeft = clamp(startBox.left + dx, 0, startBox.left + startBox.width - MIN_SIZE);
      height = clamp(startBox.height + dy, MIN_SIZE, 100 - startBox.top);
      left = newLeft;
      width = startBox.width + startBox.left - newLeft;
      break;
    }
  }

  return { top, left, width, height };
}

export function BoundingBoxEditor({
  imageUrl,
  box,
  onChange,
  previewText,
  fontColor = "#ffffff",
  fontSizePx = 24,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const boxElRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const dragRef = useRef<DragState>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [textScale, setTextScale] = useState(1);

  const getContainerRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  // テキストがボックスからはみ出す場合に scale を計算
  useLayoutEffect(() => {
    const textEl = textRef.current;
    const boxEl = boxElRef.current;
    if (!textEl || !boxEl || !previewText) {
      setTextScale(1);
      return;
    }

    // transform を scale(1) にリセットして getBoundingClientRect で自然サイズを計測
    // scrollWidth/scrollHeight は flex コンテナ内で不正確になる場合があるため使用しない
    const savedTransform = textEl.style.transform;
    textEl.style.transform = "scale(1)";

    const { width: naturalW, height: naturalH } = textEl.getBoundingClientRect();
    const boxW = boxEl.clientWidth;
    const boxH = boxEl.clientHeight;

    // 計測後に元の transform に戻す（次の render まで保持）
    textEl.style.transform = savedTransform;

    if (!naturalW || !naturalH || !boxW || !boxH) {
      setTextScale(1);
      return;
    }

    setTextScale(Math.min(boxW / naturalW, boxH / naturalH, 1));
  }, [previewText, fontSizePx, box]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const rect = getContainerRect();
      if (!rect) return;

      const dx = ((e.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragRef.current.startY) / rect.height) * 100;

      onChange(applyDelta(dragRef.current.type, dragRef.current.startBox, dx, dy));
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setIsDragging(false);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [getContainerRect, onChange]);

  const startDrag = (type: DragType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...box },
    };
    setIsDragging(true);
  };

  if (!imageUrl) {
    return (
      <div
        style={{
          padding: "16px",
          color: "#6b7280",
          border: "1px dashed #d1d5db",
          borderRadius: "4px",
          textAlign: "center",
        }}
      >
        商品画像がないため、エディタを表示できません
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        userSelect: "none",
        cursor: isDragging ? "grabbing" : "default",
        borderRadius: "4px",
        overflow: "hidden",
        border: "1px solid #d1d5db",
      }}
    >
      <img
        src={imageUrl}
        alt="商品画像"
        style={{ display: "block", width: "100%", height: "auto" }}
        draggable={false}
      />

      <div
        ref={boxElRef}
        onMouseDown={(e) => startDrag("move", e)}
        style={{
          position: "absolute",
          top: `${box.top}%`,
          left: `${box.left}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          border: "2px dashed #2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.15)",
          cursor: isDragging ? "grabbing" : "grab",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {previewText ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              ref={textRef}
              style={{
                display: "inline-block",
                whiteSpace: "nowrap",
                fontSize: `${fontSizePx}px`,
                color: fontColor,
                textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                transformOrigin: "center center",
                transform: `scale(${textScale})`,
              }}
            >
              {previewText}
            </span>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "11px",
              color: "#fff",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            <div>T:{box.top.toFixed(1)}% L:{box.left.toFixed(1)}%</div>
            <div>W:{box.width.toFixed(1)}% H:{box.height.toFixed(1)}%</div>
          </div>
        )}

        {HANDLES.map((handle) => (
          <div
            key={handle.id}
            onMouseDown={(e) => startDrag(handle.id, e)}
            style={{
              position: "absolute",
              top: handle.top,
              left: handle.left,
              transform: "translate(-50%, -50%)",
              width: `${HANDLE_SIZE}px`,
              height: `${HANDLE_SIZE}px`,
              backgroundColor: "#fff",
              border: "2px solid #2563eb",
              borderRadius: "2px",
              cursor: handle.cursor,
              zIndex: 10,
            }}
          />
        ))}
      </div>
    </div>
  );
}
