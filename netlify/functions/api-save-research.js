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
    const {
      id,
      entityType,
      entityName,
      data,
      confidence,
      sources,
      userId = 'anonymous'
    } = body;

    // Validate required fields
    if (!entityType || !entityName || !data) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'entityType, entityName, and data are required',
          saved: false
        })
      };
    }

    console.log('💾 Saving research:', { entityType, entityName, userId });

    // Prepare research record
    const researchRecord = {
      id: id || `research-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      entity_type: entityType,
      entity_name: entityName,
      research_data: data,
      confidence_score: confidence || null,
      sources: sources || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      session_id: context.awsRequestId,
      metadata: {
        saved_via: 'user_service',
        data_size: JSON.stringify(data).length,
        source_count: (sources || []).length
      }
    };

    // Check if research table exists, create if not
    try {
      const { data: tableCheck } = await supabase
        .from('saved_research')
        .select('count')
        .limit(1);
    } catch (tableError) {
      console.log('📋 Creating saved_research table...');
      
      // Create the saved_research table if it doesn't exist
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS saved_research (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          research_data JSONB NOT NULL,
          confidence_score DECIMAL(3,2),
          sources TEXT[],
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          session_id TEXT,
          metadata JSONB
        );
        
        CREATE INDEX IF NOT EXISTS idx_saved_research_user_id ON saved_research(user_id);
        CREATE INDEX IF NOT EXISTS idx_saved_research_entity_type ON saved_research(entity_type);
        CREATE INDEX IF NOT EXISTS idx_saved_research_created_at ON saved_research(created_at);
      `;

      // Note: In production, table creation should be handled via migrations
      // For now, we'll use the RPC function approach
      const { error: rpcError } = await supabase.rpc('execute_sql', {
        sql_query: createTableSQL
      });

      if (rpcError) {
        console.warn('Could not create table via RPC:', rpcError.message);
        // Continue anyway - the table might already exist
      }
    }

    // Try to upsert the research record
    const { data: savedResearch, error: saveError } = await supabase
      .from('saved_research')
      .upsert([researchRecord], { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (saveError) {
      console.error('Research save error:', saveError);
      
      // If table doesn't exist, try to save to a generic data store
      if (saveError.code === '42P01') { // Table doesn't exist
        console.log('📝 Falling back to generic data storage...');
        
        const fallbackRecord = {
          id: researchRecord.id,
          type: 'saved_research',
          data: researchRecord,
          created_at: new Date().toISOString()
        };

        const { data: fallbackSaved, error: fallbackError } = await supabase
          .from('generic_data_store')
          .insert([fallbackRecord])
          .select()
          .single();

        if (fallbackError) {
          console.error('Fallback save also failed:', fallbackError);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to save research data',
              saved: false,
              fallbackAttempted: true
            })
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            saved: true,
            research: fallbackRecord,
            message: 'Research saved to fallback storage',
            fallbackUsed: true
          })
        };
      } else {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: `Database error: ${saveError.message}`,
            saved: false
          })
        };
      }
    }

    // Also save to user analytics
    try {
      await supabase
        .from('user_analytics')
        .insert([{
          user_id: userId,
          action: 'save_research',
          entity_type: entityType,
          entity_name: entityName,
          confidence_score: confidence,
          sources_count: (sources || []).length,
          data_size_bytes: JSON.stringify(data).length,
          session_id: context.awsRequestId,
          timestamp: new Date().toISOString()
        }]);
    } catch (analyticsError) {
      console.warn('Analytics save failed:', analyticsError.message);
      // Don't fail the main request for analytics issues
    }

    console.log('✅ Research saved successfully:', savedResearch.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        saved: true,
        research: savedResearch,
        metadata: {
          id: savedResearch.id,
          entityType,
          entityName,
          userId,
          savedAt: savedResearch.created_at,
          dataSize: JSON.stringify(data).length,
          sourcesCount: (sources || []).length
        }
      })
    };

  } catch (error) {
    console.error('Research save error:', error);
    
    // Log error for debugging
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase
        .from('error_logs')
        .insert([{
          endpoint: 'api-save-research',
          error_message: error.message,
          error_stack: error.stack,
          request_id: context.awsRequestId,
          timestamp: new Date().toISOString()
        }]);
    } catch (logError) {
      console.warn('Error logging failed:', logError.message);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Failed to save research: ' + error.message,
        saved: false
      })
    };
  }
};