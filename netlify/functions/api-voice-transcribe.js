const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

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
    console.log('🎤 Voice transcription request received');

    // Check for API keys
    if (!process.env.OPENAI_API_KEY && !process.env.DEEPGRAM_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'No transcription service configured. Please set OPENAI_API_KEY or DEEPGRAM_API_KEY.',
          transcript: ''
        })
      };
    }

    // Parse multipart form data manually since Netlify functions don't have built-in multipart support
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    
    if (!contentType.includes('multipart/form-data') && !contentType.includes('audio/')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Content-Type must be multipart/form-data or audio/*',
          transcript: ''
        })
      };
    }

    // Extract audio data from the request
    const body = event.body;
    const isBase64 = event.isBase64Encoded;
    
    if (!body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'No audio data provided',
          transcript: ''
        })
      };
    }

    let audioBuffer;
    if (isBase64) {
      audioBuffer = Buffer.from(body, 'base64');
    } else {
      audioBuffer = Buffer.from(body);
    }

    console.log('📄 Audio buffer size:', audioBuffer.length, 'bytes');

    let transcript = '';
    
    // Try OpenAI Whisper first (generally more accurate)
    if (process.env.OPENAI_API_KEY) {
      try {
        transcript = await transcribeWithOpenAI(audioBuffer);
        console.log('✅ OpenAI transcription successful');
      } catch (openaiError) {
        console.warn('OpenAI transcription failed:', openaiError.message);
        
        // Fallback to Deepgram if available
        if (process.env.DEEPGRAM_API_KEY) {
          try {
            transcript = await transcribeWithDeepgram(audioBuffer);
            console.log('✅ Deepgram transcription successful (fallback)');
          } catch (deepgramError) {
            console.error('Deepgram transcription also failed:', deepgramError.message);
            throw new Error('All transcription services failed');
          }
        } else {
          throw openaiError;
        }
      }
    } else if (process.env.DEEPGRAM_API_KEY) {
      try {
        transcript = await transcribeWithDeepgram(audioBuffer);
        console.log('✅ Deepgram transcription successful');
      } catch (deepgramError) {
        console.error('Deepgram transcription failed:', deepgramError.message);
        throw deepgramError;
      }
    }

    // Clean up transcript
    transcript = transcript.trim();
    
    // Log for analytics (without storing PII)
    console.log('🎯 Transcription completed, length:', transcript.length);

    // Optional: Store transcription analytics in Supabase (without storing actual transcript)
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase
        .from('voice_analytics')
        .insert([{
          session_id: context.awsRequestId,
          audio_size_bytes: audioBuffer.length,
          transcript_length: transcript.length,
          service_used: process.env.OPENAI_API_KEY ? 'openai' : 'deepgram',
          success: true,
          timestamp: new Date().toISOString()
        }]);
    } catch (analyticsError) {
      console.warn('Analytics logging failed:', analyticsError.message);
      // Don't fail the request for analytics issues
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        transcript: transcript,
        metadata: {
          audioSizeBytes: audioBuffer.length,
          transcriptLength: transcript.length,
          serviceUsed: process.env.OPENAI_API_KEY ? 'openai' : 'deepgram',
          timestamp: new Date().toISOString()
        }
      })
    };

  } catch (error) {
    console.error('Voice transcription error:', error);
    
    // Log error analytics
    try {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      await supabase
        .from('voice_analytics')
        .insert([{
          session_id: context.awsRequestId,
          success: false,
          error_message: error.message,
          timestamp: new Date().toISOString()
        }]);
    } catch (analyticsError) {
      console.warn('Error analytics logging failed:', analyticsError.message);
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: 'Transcription failed: ' + error.message,
        transcript: ''
      })
    };
  }
};

// Transcribe audio using OpenAI Whisper
async function transcribeWithOpenAI(audioBuffer) {
  try {
    // Create FormData for file upload to OpenAI
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('file', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');
    formData.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const transcript = await response.text();
    return transcript.trim();
  } catch (error) {
    throw new Error(`OpenAI transcription failed: ${error.message}`);
  }
}

// Transcribe audio using Deepgram
async function transcribeWithDeepgram(audioBuffer) {
  const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'audio/wav'
    },
    body: audioBuffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  if (!result.results || !result.results.channels || !result.results.channels[0] || !result.results.channels[0].alternatives) {
    throw new Error('No transcription results from Deepgram');
  }

  const transcript = result.results.channels[0].alternatives[0].transcript;
  return transcript.trim();
}