import { useEffect, useMemo, useRef } from 'react';

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
  quickReplies = [],
  onQuickReply,
  askEnableInjuryMode = false,
  askApplyPlanUpdate = false,
  onInjuryModeDecision,
  onPlanUpdateDecision
}) => {
  const listRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isOpen, messages, askEnableInjuryMode, askApplyPlanUpdate]);

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
        alignItems: 'flex-end'
      }}
      onClick={onClose}
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
          boxShadow: '0 -16px 30px rgba(0,0,0,0.45)'
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
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.75)',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1
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
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#1f71c2',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => onInjuryModeDecision?.(false)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                    cursor: 'pointer'
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
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#1f71c2',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Yes
                </button>
                <button
                  onClick={() => onPlanUpdateDecision?.(false)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                    cursor: 'pointer'
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
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.95)',
                  fontSize: '12px',
                  padding: '7px 12px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
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
          <input
            value={inputValue}
            onChange={(e) => onInputChange?.(e.target.value)}
            placeholder="Ask your coach..."
            style={{
              flex: 1,
              height: '42px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              padding: '0 12px',
              fontSize: '15px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isSending || !inputValue.trim()}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '999px',
              border: 'none',
              background: isSending || !inputValue.trim() ? 'rgba(255,255,255,0.2)' : '#1f71c2',
              color: '#fff',
              fontSize: '18px',
              cursor: isSending || !inputValue.trim() ? 'not-allowed' : 'pointer'
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
