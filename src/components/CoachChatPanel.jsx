import { useEffect, useMemo, useRef, useState } from 'react';

const roleStyle = {
  assistant: {
    alignSelf: 'flex-start',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--color-text-primary)'
  },
  user: {
    alignSelf: 'flex-end',
    background: 'linear-gradient(135deg, #1f71c2, #2f8fe9)',
    color: '#ffffff'
  }
};

const CoachChatPanel = ({
  isOpen,
  onClose,
  messages,
  inputValue,
  onInputChange,
  onSend,
  isSending = false,
  isPlanApplying = false,
  disableInteractions = false,
  quickReplies = [],
  onQuickReply,
  askEnableInjuryMode = false,
  askApplyPlanUpdate = false,
  onInjuryModeDecision,
  onPlanUpdateDecision
}) => {
  const listRef = useRef(null);
  const textareaRef = useRef(null);
  const [applyDots, setApplyDots] = useState('');
  const isBusy = isSending || isPlanApplying || disableInteractions;

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen, messages, askEnableInjuryMode, askApplyPlanUpdate, isPlanApplying]);

  useEffect(() => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const minHeight = 42;
    const maxHeight = 104; // roughly 4 visible lines at 16px.
    el.style.height = 'auto';
    const nextHeight = Math.max(minHeight, Math.min(el.scrollHeight, maxHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputValue]);

  useEffect(() => {
    if (!isPlanApplying) {
      setApplyDots('');
      return;
    }
    let tick = 0;
    const intervalId = setInterval(() => {
      tick = (tick + 1) % 4;
      setApplyDots('.'.repeat(tick));
    }, 350);
    return () => clearInterval(intervalId);
  }, [isPlanApplying]);

  const renderedMessages = useMemo(
    () => (Array.isArray(messages) ? messages : []),
    [messages]
  );

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 10020,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
        touchAction: 'manipulation'
      }}
      onClick={() => {
        if (!disableInteractions) onClose?.();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          height: '78vh',
          maxHeight: '820px',
          borderTopLeftRadius: '18px',
          borderTopRightRadius: '18px',
          background: 'linear-gradient(180deg, rgba(42,42,42,0.98), rgba(25,25,25,0.98))',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 -16px 30px rgba(0,0,0,0.45)',
          WebkitTextSizeAdjust: '100%'
        }}
      >
        <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#f3f3f3', fontSize: '20px', fontWeight: 600 }}>Coach</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>
                Updates your plan automatically
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={disableInteractions}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.75)',
                cursor: disableInteractions ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                opacity: disableInteractions ? 0.6 : 1
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {renderedMessages.map((message) => (
            <div
              key={message.id}
              style={{
                maxWidth: '82%',
                padding: '10px 12px',
                borderRadius: '12px',
                fontSize: '15px',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
                ...(roleStyle[message.role] || roleStyle.assistant)
              }}
            >
              {message.content}
            </div>
          ))}

          {isSending && (
            <div
              style={{
                maxWidth: '82%',
                alignSelf: 'flex-start',
                padding: '10px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.7)'
              }}
            >
              Thinking...
            </div>
          )}

          {isPlanApplying && (
            <div
              style={{
                maxWidth: '82%',
                alignSelf: 'flex-start',
                padding: '10px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                background: 'rgba(31,113,194,0.18)',
                color: '#dcebff',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(220,235,255,0.35)',
                  borderTopColor: '#dcebff',
                  borderRadius: '50%',
                  animation: 'spin 0.9s linear infinite'
                }}
              />
              <span>Applying plan changes{applyDots}</span>
            </div>
          )}

          {askEnableInjuryMode && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '92%',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ color: '#f7f7f7', fontSize: '14px', marginBottom: '8px' }}>
                Turn on injury mode?
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onInjuryModeDecision?.(true)}
                  disabled={isBusy}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#1f71c2',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.6 : 1
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => onInjuryModeDecision?.(false)}
                  disabled={isBusy}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.6 : 1
                  }}
                >
                  No
                </button>
              </div>
            </div>
          )}

          {askApplyPlanUpdate && (
            <div
              style={{
                alignSelf: 'flex-start',
                maxWidth: '92%',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.05)'
              }}
            >
              <div style={{ color: '#f7f7f7', fontSize: '14px', marginBottom: '8px' }}>
                Should I update this week&apos;s plan?
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => onPlanUpdateDecision?.(true)}
                  disabled={isBusy}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#1f71c2',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.6 : 1
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => onPlanUpdateDecision?.(false)}
                  disabled={isBusy}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.6 : 1
                  }}
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>

        {quickReplies.length > 0 && (
          <div
            style={{
              padding: '0 12px 10px',
              display: 'flex',
              gap: '8px',
              overflowX: 'auto'
            }}
          >
            {quickReplies.slice(0, 4).map((reply) => (
              <button
                key={reply}
                onClick={() => onQuickReply?.(reply)}
                disabled={isBusy}
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: '12px',
                  padding: '7px 12px',
                  whiteSpace: 'nowrap',
                  cursor: isBusy ? 'not-allowed' : 'pointer',
                  opacity: isBusy ? 0.6 : 1
                }}
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={onSend}
          style={{
            padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            gap: '8px'
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend?.(e);
              }
            }}
            placeholder="Ask your coach..."
            disabled={isBusy}
            rows={1}
            style={{
              flex: 1,
              minHeight: '42px',
              maxHeight: '104px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              padding: '10px 12px',
              fontSize: '16px',
              lineHeight: 1.35,
              outline: 'none',
              resize: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isBusy || !inputValue.trim()}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '999px',
              border: 'none',
              background: isBusy || !inputValue.trim() ? 'rgba(255,255,255,0.2)' : '#1f71c2',
              color: '#fff',
              fontSize: '18px',
              cursor: isBusy || !inputValue.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            →
          </button>
        </form>
      </div>
    </div>
  );
};

export default CoachChatPanel;
