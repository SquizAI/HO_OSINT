const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { input, entityType, includeWebScraping = false } = body;

    if (!input || !entityType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Input text and entityType are required',
          entity: null
        })
      };
    }

    console.log('🏗️ Creating entity from text:', { entityType, inputLength: input.length });

    // Extract URLs from input
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = input.match(urlRegex) || [];

    // Prepare AI prompt based on entity type
    let aiPrompt = '';
    let extractionRules = {};

    switch (entityType) {
      case 'person':
        aiPrompt = `Extract person information from the following text. Return a JSON object with these fields:
        {
          "name": "Full name",
          "title": "Job title/position", 
          "company": "Company name",
          "email": "Email address",
          "phone": "Phone number",
          "linkedin": "LinkedIn URL",
          "location": "City, State",
          "bio": "Brief bio/description",
          "expertise": ["area1", "area2"],
          "confidence": 0.85
        }`;
        extractionRules = {
          table: 'people',
          requiredFields: ['name'],
          optionalFields: ['title', 'company', 'email', 'phone', 'linkedin', 'location', 'bio', 'expertise']
        };
        break;

      case 'company':
        aiPrompt = `Extract company information from the following text. Return a JSON object with these fields:
        {
          "name": "Company name",
          "description": "Company description",
          "website": "Website URL",
          "city": "City",
          "state": "State",
          "sectors": "Industry sectors",
          "size": "Company size",
          "founded": "Founded year",
          "headquarters": "HQ address",
          "confidence": 0.85
        }`;
        extractionRules = {
          table: 'companies',
          requiredFields: ['name'],
          optionalFields: ['description', 'website', 'city', 'state', 'sectors', 'size', 'founded', 'headquarters']
        };
        break;

      case 'project':
        aiPrompt = `Extract project information from the following text. Return a JSON object with these fields:
        {
          "title": "Project name/title",
          "description": "Project description",
          "location": "Project location",
          "type": "Project type (residential, commercial, etc.)",
          "status": "Project status",
          "developer": "Developer company",
          "architect": "Architect firm",
          "contractor": "General contractor",
          "budget": "Project budget",
          "timeline": "Project timeline",
          "confidence": 0.85
        }`;
        extractionRules = {
          table: 'projects',
          requiredFields: ['title'],
          optionalFields: ['description', 'location', 'type', 'status', 'developer', 'architect', 'contractor', 'budget', 'timeline']
        };
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Invalid entity type. Must be person, company, or project',
            entity: null
          })
        };
    }

    // Enhanced input with web scraping if URLs found and requested
    let enhancedInput = input;
    let scrapedData = null;

    if (includeWebScraping && urls.length > 0) {
      try {
        console.log('🌐 Web scraping enabled for URLs:', urls);
        
        // Use existing Firecrawl endpoint for scraping
        const scrapeResponse = await fetch(`${process.env.NETLIFY_FUNCTIONS_URL || 'https://hoea.netlify.app/.netlify/functions'}/api-firecrawl-extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls: urls.slice(0, 3), // Limit to 3 URLs to avoid rate limits
            includeMarkdown: true
          })
        });

        if (scrapeResponse.ok) {
          const scrapeData = await scrapeResponse.json();
          scrapedData = scrapeData.data;
          
          // Append scraped content to input
          if (scrapedData && scrapedData.length > 0) {
            enhancedInput += '\n\nAdditional web content:\n' + 
              scrapedData.map(page => page.markdown || page.content || '').join('\n\n');
          }
        }
      } catch (scrapeError) {
        console.warn('Web scraping failed:', scrapeError.message);
        // Continue without scraped data
      }
    }

    // Use Anthropic Claude for AI extraction
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1000,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: `${aiPrompt}

Text to extract from:
${enhancedInput}

Return only valid JSON, no other text.`
          }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      throw new Error(`Anthropic API error: ${anthropicResponse.status}`);
    }

    const anthropicData = await anthropicResponse.json();
    const aiResponse = anthropicData.content[0].text;

    // Parse AI response as JSON
    let extractedData;
    try {
      extractedData = JSON.parse(aiResponse);
    } catch (parseError) {
      // Fallback: try to extract JSON from the response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response as JSON');
      }
    }

    // Validate required fields
    const missingFields = extractionRules.requiredFields.filter(field => !extractedData[field]);
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          entity: extractedData
        })
      };
    }

    // Add metadata
    extractedData.type = entityType;
    extractedData.source = 'ai_extraction';
    extractedData.created_at = new Date().toISOString();
    extractedData.raw_input = input.substring(0, 1000); // Store first 1000 chars
    
    if (urls.length > 0) {
      extractedData.source_urls = urls;
    }
    
    if (scrapedData) {
      extractedData.scraping_metadata = {
        pages_scraped: scrapedData.length,
        scraping_timestamp: new Date().toISOString()
      };
    }

    // Save to database
    const { data: savedEntity, error: saveError } = await supabase
      .from(extractionRules.table)
      .insert([extractedData])
      .select()
      .single();

    if (saveError) {
      console.error('Database save error:', saveError);
      // Return the extracted data even if save fails
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          entity: extractedData,
          warning: 'Entity extracted but not saved to database',
          error: saveError.message
        })
      };
    }

    console.log('✅ Entity created successfully:', savedEntity.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        entity: savedEntity,
        metadata: {
          entityType,
          confidence: extractedData.confidence || 0.8,
          urlsProcessed: urls.length,
          webScrapingUsed: includeWebScraping && urls.length > 0,
          created_id: savedEntity.id
        }
      })
    };

  } catch (error) {
    console.error('Entity creation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to create entity: ' + error.message,
        entity: null
      })
    };
  }
};