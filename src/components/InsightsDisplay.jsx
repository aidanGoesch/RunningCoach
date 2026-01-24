const InsightsDisplay = ({ insights }) => {
  if (!insights) return null;

  return (
    <div className="workout-display" style={{ marginTop: '20px' }}>
      <div className="workout-title">🧠 AI Insights</div>
      
      {insights.summary && (
        <div className="workout-block">
          <div className="block-title">Performance Summary</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.summary}
          </div>
        </div>
      )}

      {insights.strengths && (
        <div className="workout-block">
          <div className="block-title">✅ Strengths</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.strengths}
          </div>
        </div>
      )}

      {insights.improvements && (
        <div className="workout-block">
          <div className="block-title">📈 Areas for Improvement</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.improvements}
          </div>
        </div>
      )}

      {insights.nextWorkout && (
        <div className="workout-block">
          <div className="block-title">🎯 Next Workout Recommendation</div>
          <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
            {insights.nextWorkout}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsDisplay;
