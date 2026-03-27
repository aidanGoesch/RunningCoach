import { dataService } from './supabase';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const COACH_CHAT_MODEL = 'gpt-4o-mini';

const DEFAULT_CONTEXT = {
  injuryMode: false,
  injurySummary: '',
  injuryDetails: {
    location: '',
    sensation: '',
    duration: '',
    aggravators: '',
    alleviators: ''
  },
  constraints: {
    maxRunsThisWeek: null,
    availableDays: [],
    notes: ''
  },
  priorities: [],
  recoveryStatus: '',
  lastUpdated: null
};

const DEFAULT_META = {
  lastWeeklyRecoveryCheckWeekKey: null
};

const safeJsonParse = (value, fallback) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const mergeContext = (current, patch) => {
  if (!patch || typeof patch !== 'object') return current;
  return {
    ...current,
    ...patch,
    injuryDetails: {
      ...(current.injuryDetails || {}),
      ...(patch.injuryDetails || {})
    },
    constraints: {
      ...(current.constraints || {}),
      ...(patch.constraints || {})
    },
    priorities: Array.isArray(patch.priorities)
      ? patch.priorities
      : (current.priorities || [])
  };
};

export const loadCoachAgentContext = async () => {
  try {
    const raw = await dataService.get('coach_agent_context');
    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CONTEXT };
    return mergeContext({ ...DEFAULT_CONTEXT }, parsed);
  } catch {
    return { ...DEFAULT_CONTEXT };
  }
};

export const saveCoachAgentContext = async (context) => {
  const finalContext = mergeContext(
    { ...DEFAULT_CONTEXT },
    {
      ...(context || {}),
      lastUpdated: new Date().toISOString()
    }
  );
  await dataService.set('coach_agent_context', JSON.stringify(finalContext));
  return finalContext;
};

export const patchCoachAgentContext = async (patch) => {
  const current = await loadCoachAgentContext();
  const merged = mergeContext(current, patch);
  return saveCoachAgentContext(merged);
};

export const loadCoachChatHistory = async () => {
  try {
    const raw = await dataService.get('coach_chat_history');
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCoachChatHistory = async (messages) => {
  const finalMessages = Array.isArray(messages) ? messages : [];
  await dataService.set('coach_chat_history', JSON.stringify(finalMessages));
  return finalMessages;
};

export const appendCoachChatHistory = async (...messages) => {
  const existing = await loadCoachChatHistory();
  const next = existing.concat(messages.filter(Boolean));
  await saveCoachChatHistory(next);
  return next;
};

export const loadCoachChatMeta = async () => {
  try {
    const raw = await dataService.get('coach_chat_meta');
    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
  }
};

export const saveCoachChatMeta = async (meta) => {
  const next = { ...DEFAULT_META, ...(meta || {}) };
  await dataService.set('coach_chat_meta', JSON.stringify(next));
  return next;
};

export const buildWeeklyRecoveryCheckinMessage = () =>
  'How is your injury recovery going this week? If anything changed, I can adjust your plan.';

const buildCoachSystemPrompt = ({ context, activities, weeklyPlan }) => {
  const recentRunCount = (activities || []).filter((a) => a?.type === 'Run').length;
  const knownPlanDays = weeklyPlan
    ? Object.keys(weeklyPlan).filter((k) => ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(k))
    : [];

  return `You are a running coach assistant inside a training app.

You must provide:
1) A concise coaching response.
2) Structured machine-readable metadata describing whether injury mode and plan updates should be prompted.

Safety and scope rules:
- Non-diagnostic coaching only. Never diagnose conditions.
- Give light recovery guidance only (reduce load, easy effort, mobility, rest, stop-if-worse).
- If there are red flags (sharp worsening pain, numbness, inability to bear weight), advise professional care.

Behavior requirements:
- If the user mentions pain/injury, ask focused follow-up questions if key details are missing (location, sensation, duration, aggravators).
- Injury-mode question and plan-update question are separate. Signal both independently.
- If the user asks about prioritization or limited runs/time, give practical prioritization and signal a potential plan update.
- Suggested plan action should usually be "regenerate_current_week" for app-side application.

Current context:
${JSON.stringify(context || {}, null, 2)}

Recent runs count:
${recentRunCount}

Known current week plan days:
${JSON.stringify(knownPlanDays)}

Return ONLY valid JSON in this exact shape:
{
  "assistantMessage": "string",
  "detectedSignals": {
    "mentionsInjury": true,
    "mentionsRecoveryProgress": false,
    "mentionsTimeConstraint": false,
    "mentionsTrainingPriorities": false
  },
  "suggestedContextPatch": {
    "injuryMode": false,
    "injurySummary": "",
    "injuryDetails": {
      "location": "",
      "sensation": "",
      "duration": "",
      "aggravators": "",
      "alleviators": ""
    },
    "constraints": {
      "maxRunsThisWeek": null,
      "availableDays": [],
      "notes": ""
    },
    "priorities": [],
    "recoveryStatus": ""
  },
  "askEnableInjuryMode": false,
  "askApplyPlanUpdate": false,
  "suggestedPlanAction": "none",
  "suggestedQuestions": []
}`;
};

const extractJson = (content) => {
  if (!content) return null;
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const fallbackResponse = (userMessage) => {
  const lower = (userMessage || '').toLowerCase();
  const mentionsInjury = /(injur|pain|knee|ankle|hip|achilles|hamstring|shin)/.test(lower);
  const mentionsTimeConstraint = /(only|two runs|2 runs|time|busy|limited)/.test(lower);
  const mentionsRecoveryProgress = /(recover|better|faster|improv)/.test(lower);
  const mentionsTrainingPriorities = /(priorit|focus|goal|what should i do)/.test(lower);

  let assistantMessage = 'I can help with that. Tell me a bit more so I can tailor your training this week.';
  if (mentionsInjury) {
    assistantMessage = 'Sorry you are dealing with this. Is the discomfort sharp or dull, where exactly is it, and what makes it worse or better?';
  } else if (mentionsTimeConstraint) {
    assistantMessage = 'If you only have a couple runs, prioritize one quality session and one long easy run. I can update this week to match that.';
  }

  return {
    assistantMessage,
    detectedSignals: {
      mentionsInjury,
      mentionsRecoveryProgress,
      mentionsTimeConstraint,
      mentionsTrainingPriorities
    },
    suggestedContextPatch: {
      recoveryStatus: mentionsRecoveryProgress ? 'recovering_faster' : ''
    },
    askEnableInjuryMode: mentionsInjury,
    askApplyPlanUpdate: mentionsInjury || mentionsTimeConstraint || mentionsRecoveryProgress || mentionsTrainingPriorities,
    suggestedPlanAction: (mentionsInjury || mentionsTimeConstraint || mentionsRecoveryProgress || mentionsTrainingPriorities)
      ? 'regenerate_current_week'
      : 'none',
    suggestedQuestions: []
  };
};

export const sendCoachMessage = async ({
  apiKey,
  userMessage,
  context,
  activities = [],
  weeklyPlan = null,
  history = []
}) => {
  if (!apiKey) {
    throw new Error('Missing OpenAI API key');
  }

  const systemPrompt = buildCoachSystemPrompt({ context, activities, weeklyPlan });
  const historyMessages = (history || [])
    .slice(-10)
    .map((m) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: String(m?.content || '')
    }));

  const body = {
    model: COACH_CHAT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: userMessage }
    ],
    temperature: 0.4,
    max_completion_tokens: 800
  };

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Coach chat request failed');
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);
    if (!parsed) {
      return fallbackResponse(userMessage);
    }

    return {
      assistantMessage: parsed.assistantMessage || fallbackResponse(userMessage).assistantMessage,
      detectedSignals: {
        mentionsInjury: !!parsed?.detectedSignals?.mentionsInjury,
        mentionsRecoveryProgress: !!parsed?.detectedSignals?.mentionsRecoveryProgress,
        mentionsTimeConstraint: !!parsed?.detectedSignals?.mentionsTimeConstraint,
        mentionsTrainingPriorities: !!parsed?.detectedSignals?.mentionsTrainingPriorities
      },
      suggestedContextPatch: parsed?.suggestedContextPatch || {},
      askEnableInjuryMode: !!parsed?.askEnableInjuryMode,
      askApplyPlanUpdate: !!parsed?.askApplyPlanUpdate,
      suggestedPlanAction: parsed?.suggestedPlanAction || 'none',
      suggestedQuestions: Array.isArray(parsed?.suggestedQuestions) ? parsed.suggestedQuestions : []
    };
  } catch (error) {
    console.error('Coach chat failed:', error);
    return fallbackResponse(userMessage);
  }
};
