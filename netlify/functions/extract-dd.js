// Netlify serverless function to extract DD report data via Claude API
exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' })
    };
  }

  try {
    const { pdfBase64 } = JSON.parse(event.body);
    
    if (!pdfBase64) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No PDF data provided' })
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64
              }
            },
            {
              type: 'text',
              text: `Extract deal information from this due diligence report. Return ONLY a JSON object with these fields (use empty string if not found):
{
  "companyName": "company name in English",
  "companyNameJa": "company name in Japanese if available",
  "sector": "industry sector (e.g. AI / ML, FinTech, Healthcare)",
  "sectorJa": "sector in Japanese",
  "stage": "funding stage (Seed, Series A, Series B, or Series C)",
  "coInvestors": "comma-separated list of co-investors",
  "description": "brief company description",
  "descriptionJa": "description in Japanese",
  "valuation": "valuation (e.g. $100M)",
  "revenue": "annual revenue or ARR",
  "employees": "employee count",
  "growth": "growth rate (e.g. 150%)",
  "checkSize": "investment amount",
  "investmentThesis": "why this is a good investment",
  "investmentThesisJa": "investment thesis in Japanese",
  "type": "fund or syndication"
}
Return ONLY valid JSON, no other text.`
            }
          ]
        }]
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: result.error?.message || 'API error' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
