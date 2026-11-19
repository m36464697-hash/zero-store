import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Headphones, MessageCircle, Send, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface FloatingSupportWidgetProps {
  onOpenAuth: () => void;
}

const BTN_SIZE = 56;
const EDGE_MARGIN = 16;

function clampPosition(x: number, y: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 20, y: 20 };
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - BTN_SIZE - EDGE_MARGIN);
  const maxY = Math.max(EDGE_MARGIN, window.innerHeight - BTN_SIZE - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(EDGE_MARGIN, x), maxX),
    y: Math.min(Math.max(EDGE_MARGIN, y), maxY),
  };
}

function formatMessageTime(ts: unknown): string {
  if (!ts) return 'الآن';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    const d = (ts as { toDate: () => Date }).toDate();
    return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  }
  return 'الآن';
}

export const FloatingSupportWidget: React.FC<FloatingSupportWidgetProps> = ({ onOpenAuth }) => {
  const {
    user,
    siteConfig,
    supportThread,
    supportMessages,
    sendSupportMessage,
    markSupportReadByUser,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Position stored as left/top viewport coordinates so dragging feels natural anywhere on screen
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 20, y: 500 };
    return clampPosition(
      window.innerWidth - BTN_SIZE - 20,
      window.innerHeight - BTN_SIZE - 20
    );
  });

  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    active: false,
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startX: 0,
    startY: 0,
    moved: false,
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && user && supportThread?.unreadByUser) {
      void markSupportReadByUser();
    }
  }, [isOpen, user, supportThread?.unreadByUser]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, supportMessages.length]);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pos.x,
      startY: pos.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (!state.active) return;

    const dx = e.clientX - state.startClientX;
    const dy = e.clientY - state.startClientY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
      state.moved = true;
    }
    if (state.moved) {
      setPos(clampPosition(state.startX + dx, state.startY + dy));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const state = dragStateRef.current;
    if (!state.active) return;
    if (state.pointerId !== null) {
      try {
        e.currentTarget.releasePointerCapture(state.pointerId);
      } catch {
        // Ignore if pointer capture already released
      }
    }
    const wasDragged = state.moved;
    state.active = false;
    state.pointerId = null;
    if (!wasDragged) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || sending) return;
    setErrorMsg('');
    setSending(true);
    try {
      await sendSupportMessage(messageText);
      setMessageText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  const accent = siteConfig.primaryAccentColor || '#10B981';

  // Compute safe viewport-clamped anchor for the chat popover relative to button position
  const panelWidth = typeof window !== 'undefined' ? Math.min(360, window.innerWidth - 24) : 340;
  const openLeftSide =
    typeof window !== 'undefined' ? pos.x + BTN_SIZE / 2 < window.innerWidth / 2 : false;
  const openDownwards =
    typeof window !== 'undefined' ? pos.y < window.innerHeight / 2 : false;

  const panelLeft =
    typeof window !== 'undefined'
      ? Math.min(
          Math.max(12, openLeftSide ? pos.x : pos.x + BTN_SIZE - panelWidth),
          window.innerWidth - panelWidth - 12
        )
      : 16;

  const panelTop =
    typeof window !== 'undefined'
      ? openDownwards
        ? Math.min(pos.y + BTN_SIZE + 10, window.innerHeight - 440 - 12)
        : Math.max(12, pos.y - 440 - 10)
      : 80;

  return (
    <>
      {/* Draggable Circular Floating Support Icon */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragStateRef.current.active = false;
        }}
        aria-label="الدعم الفني المباشر — اسحب للتحريك أو اضغط للفتح"
        title="الدعم الفني (اسحب لتحريك الدائرة)"
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          backgroundColor: accent,
          touchAction: 'none',
        }}
        className="fixed z-50 w-14 h-14 rounded-full text-white shadow-xl shadow-black/30 border-2 border-white/25 flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-105 transition-transform select-none"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Headphones className="w-6 h-6" />}

        {!isOpen && supportThread?.unreadByUser && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 border-2 border-white dark:border-[#090B0E] animate-pulse" />
        )}
      </button>

      {/* Support Chat Panel */}
      {isOpen && (
        <div
          style={{
            left: `${panelLeft}px`,
            top: `${panelTop}px`,
            width: `${panelWidth}px`,
            height: '440px',
          }}
          className="fixed z-50 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="محادثة الدعم الفني"
        >
          {/* Header */}
          <div
            className="px-4 py-3.5 text-white flex items-center justify-between gap-2 shrink-0"
            style={{ backgroundColor: accent }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold truncate">
                  الدعم الفني · {siteConfig.brandName}
                </h3>
                <p className="text-[11px] text-white/85 truncate">
                  مراسلة فورية مع فريق الإدارة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق الدردشة"
              className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conversation Body */}
          {!user ? (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                  تواصل مباشرة مع الدعم الفني
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  سجّل الدخول بحسابك لفتح تذكرة محادثة مباشرة ومتابعة ردود فريق الدعم هنا لحظياً.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAuth();
                }}
                style={{ backgroundColor: accent }}
                className="h-10 px-5 rounded-xl text-xs font-bold text-white cursor-pointer"
              >
                تسجيل الدخول للمراسلة
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-50/70 dark:bg-[#0B0E14]">
                {supportThread?.status === 'resolved' && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>تم إغلاق التذكرة من الإدارة، يمكنك إرسال رسالة جديدة لإعادة فتحها.</span>
                  </div>
                )}

                {supportMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-zinc-500 dark:text-zinc-400 px-4 space-y-2">
                    <MessageCircle className="w-8 h-8 opacity-40" />
                    <p className="font-bold text-zinc-700 dark:text-zinc-200">
                      مرحباً بك في الدعم الفني المباشر
                    </p>
                    <p>
                      اكتب استفسارك أو رقم طلبك وسيرد عليك مشرف المتجر مباشرة من لوحة التحكم.
                    </p>
                  </div>
                ) : (
                  supportMessages.map((msg) => {
                    const isMine = msg.senderRole === 'user';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            isMine
                              ? 'text-white rounded-br-sm'
                              : 'bg-white dark:bg-[#161B23] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-sm'
                          }`}
                          style={isMine ? { backgroundColor: accent } : undefined}
                        >
                          {!isMine && (
                            <p className="text-[10px] font-bold text-emerald-500 mb-0.5">
                              {msg.senderName}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                        <span className="text-[10px] text-zinc-400 mt-1 px-1">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {errorMsg && (
                <div className="px-3 py-1.5 bg-rose-500/10 text-[11px] text-rose-500">
                  {errorMsg}
                </div>
              )}

              <form
                onSubmit={handleSend}
                className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#11151B] flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  maxLength={800}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="اكتب رسالتك للدعم الفني..."
                  className="flex-1 h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={sending || !messageText.trim()}
                  style={{ backgroundColor: accent }}
                  aria-label="إرسال الرسالة"
                  className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
};
