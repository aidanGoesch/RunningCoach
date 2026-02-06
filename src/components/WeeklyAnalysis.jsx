const WeeklyAnalysis = ({ analysis }) => {
  if (!analysis || !analysis.message) {
    return null;
  }

  return (
    <div className="workout-display" style={{ marginBottom: '20px', border: '2px solid var(--accent)' }}>
      <div className="workout-title" style={{ color: 'var(--accent)' }}>
        💪 Week in Review
      </div>
      <div className="workout-block">
        <div style={{ 
          fontSize: '16px', 
          lineHeight: '1.6', 
          color: 'var(--text-color)',
          padding: '10px 0'
        }}>
          {analysis.message}
        </div>
        {analysis.metrics && (
          <div style={{ 
            marginTop: '15px', 
            paddingTop: '15px', 
            borderTop: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              {analysis.metrics.runCount !== undefined && (
                <span>Runs: {analysis.metrics.runCount}/{analysis.metrics.expectedRuns}</span>
              )}
              {analysis.metrics.totalMiles && (
                <span>Mileage: {analysis.metrics.totalMiles} mi</span>
              )}
              {analysis.metrics.totalTime && (
                <span>Time: {analysis.metrics.totalTime} min</span>
              )}
              {analysis.metrics.avgRating && (
                <span>Avg Rating: {analysis.metrics.avgRating}/5</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyAnalysis;
