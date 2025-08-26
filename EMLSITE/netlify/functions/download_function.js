// netlify/functions/download.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'GET') {
    try {
      const materialId = event.queryStringParameters.id;

      if (!materialId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'ID do material é obrigatório' })
        };
      }

      // Buscar informações do material
      const { data: material, error: fetchError } = await supabase
        .from('materials')
        .select('*')
        .eq('id', materialId)
        .single();

      if (fetchError || !material) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Material não encontrado' })
        };
      }

      // Gerar URL temporária para download
      const { data: urlData, error: urlError } = await supabase.storage
        .from('eml-materials')
        .createSignedUrl(material.file_path, 300); // 5 minutos

      if (urlError) {
        throw urlError;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          downloadUrl: urlData.signedUrl,
          fileName: material.name,
          size: material.size
        })
      };

    } catch (error) {
      console.error('Erro no download:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erro interno do servidor: ' + error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Método não permitido' })
  };
};