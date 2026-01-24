const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const generateWorkout = async (apiKey) => {
  const prompt = `Generate a running workout plan. Return the response as a JSON object with this exact structure:
{
  "title": "Workout name",
  "blocks": [
    {
      "title": "Block name (e.g., Warm-up, Main Set, Cool-down)",
      "distance": "distance with unit (e.g., 1.5 miles, 800m)",
      "pace": "pace description (e.g., Easy, 5K pace, 7:30/mile)",
      "duration": "time if applicable (e.g., 10 minutes)",
      "notes": "additional instructions"
    }
  ]
}

Create a varied workout with warm-up, main work, and cool-down. Make it realistic for a recreational runner.`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  try {
    return JSON.parse(content);
  } catch (e) {
    // Fallback if JSON parsing fails
    return {
      title: "Generated Workout",
      blocks: [
        {
          title: "Workout Generated",
          distance: "See raw response",
          pace: "Various",
          duration: "45 minutes",
          notes: content
        }
      ]
    };
  }
};

// Placeholder for future Strava integration
export const syncWithStrava = async () => {
  // TODO: Implement Strava OAuth and data fetching
  throw new Error('Strava integration not implemented yet');
};
