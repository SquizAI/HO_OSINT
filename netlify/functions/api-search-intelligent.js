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
    const { query, includeResults = true, maxResults = 10 } = body;

    if (!query || query.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Query parameter is required',
          results: []
        })
      };
    }

    console.log('🔍 Intelligent search for:', query);

    const searchTerm = query.trim();
    const results = [];

    // Search across multiple entity types in parallel
    const searchPromises = [];

    // 1. Search People
    searchPromises.push(
      supabase
        .from('people')
        .select('id, name, title, company, email, phone, linkedin, type')
        .or(`name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(Math.ceil(maxResults / 3))
        .then(({ data, error }) => {
          if (error) {
            console.error('People search error:', error);
            return [];
          }
          return (data || []).map(item => ({
            ...item,
            type: 'person',
            description: `${item.title || 'Professional'} at ${item.company || 'Unknown Company'}`,
            relevanceScore: calculateRelevance(searchTerm, item.name, item.title, item.company)
          }));
        })
    );

    // 2. Search Companies
    searchPromises.push(
      supabase
        .from('companies')
        .select('id, name, description, city, state, sectors, website, type')
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sectors.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
        .limit(Math.ceil(maxResults / 3))
        .then(({ data, error }) => {
          if (error) {
            console.error('Companies search error:', error);
            return [];
          }
          return (data || []).map(item => ({
            ...item,
            type: 'company',
            description: item.description || `${item.sectors || 'Company'} based in ${item.city || 'Unknown'}, ${item.state || ''}`,
            relevanceScore: calculateRelevance(searchTerm, item.name, item.description, item.sectors)
          }));
        })
    );

    // 3. Search Projects
    searchPromises.push(
      supabase
        .from('projects')
        .select('id, title, description, location, type, status, developer, architect')
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,developer.ilike.%${searchTerm}%,architect.ilike.%${searchTerm}%`)
        .limit(Math.ceil(maxResults / 3))
        .then(({ data, error }) => {
          if (error) {
            console.error('Projects search error:', error);
            return [];
          }
          return (data || []).map(item => ({
            ...item,
            type: 'project',
            name: item.title,
            description: item.description || `${item.type || 'Project'} in ${item.location || 'Unknown location'}`,
            relevanceScore: calculateRelevance(searchTerm, item.title, item.description, item.location)
          }));
        })
    );

    // Execute all searches in parallel
    const searchResults = await Promise.all(searchPromises);
    
    // Combine and flatten results
    const allResults = searchResults.flat();

    // Sort by relevance score and limit
    const sortedResults = allResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    // Add search analytics
    const analytics = {
      totalResults: allResults.length,
      resultsByType: {
        people: searchResults[0].length,
        companies: searchResults[1].length,
        projects: searchResults[2].length
      },
      searchTerm: searchTerm,
      timestamp: new Date().toISOString()
    };

    console.log('🎯 Search completed:', analytics);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        query: searchTerm,
        results: includeResults ? sortedResults : [],
        analytics,
        totalResults: allResults.length
      })
    };

  } catch (error) {
    console.error('Intelligent search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error during search',
        results: []
      })
    };
  }
};

// Calculate relevance score based on search term matching
function calculateRelevance(searchTerm, ...fields) {
  const term = searchTerm.toLowerCase();
  let score = 0;
  
  fields.forEach((field, index) => {
    if (!field) return;
    
    const fieldValue = field.toString().toLowerCase();
    const weight = 1 / (index + 1); // First field gets highest weight
    
    // Exact match gets highest score
    if (fieldValue === term) {
      score += 100 * weight;
    }
    // Starts with search term
    else if (fieldValue.startsWith(term)) {
      score += 80 * weight;
    }
    // Contains search term
    else if (fieldValue.includes(term)) {
      score += 60 * weight;
    }
    // Fuzzy match (words within field contain search term)
    else {
      const words = fieldValue.split(' ');
      const matchingWords = words.filter(word => word.includes(term)).length;
      if (matchingWords > 0) {
        score += (30 * matchingWords / words.length) * weight;
      }
    }
  });
  
  return score;
}