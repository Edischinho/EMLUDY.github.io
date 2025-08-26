// netlify/functions/upload.js
const { createClient } = require('@supabase/supabase-js');
const formidable = require('formidable');
const { v4: uuidv4 } = require('uuid');

// Configuração do Supabase (você precisa preencher com suas credenciais)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod === 'POST') {
    try {
      // Parse do formulário multipart
      const form = formidable({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(event.body);
      
      const file = files.file[0];
      const subjectId = fields.subjectId[0];
      const subjectName = fields.subjectName[0];
      const userId = fields.userId[0];
      const userName = fields.userName[0];

      if (!file) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Nenhum arquivo enviado' })
        };
      }

      // Gerar nome único para o arquivo
      const fileExtension = file.originalFilename.split('.').pop();
      const fileName = `${uuidv4()}.${fileExtension}`;
      const filePath = `materials/${fileName}`;

      // Upload para o Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('eml-materials')
        .upload(filePath, file, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Salvar metadados no banco
      const { data, error } = await supabase
        .from('materials')
        .insert([
          {
            id: uuidv4(),
            name: file.originalFilename,
            file_name: fileName,
            file_path: filePath,
            size: file.size,
            type: file.mimetype,
            subject_id: parseInt(subjectId),
            subject_name: subjectName,
            uploaded_by: parseInt(userId),
            uploaded_by_name: userName,
            created_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          material: data[0],
          message: 'Arquivo enviado com sucesso!' 
        })
      };

    } catch (error) {
      console.error('Erro no upload:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Erro interno do servidor: ' + error.message })
      };
    }
  }

  // GET - Listar materiais
  if (event.httpMethod === 'GET') {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  // DELETE - Remover material
  if (event.httpMethod === 'DELETE') {
    try {
      const materialId = event.queryStringParameters.id;
      
      // Buscar arquivo para deletar do storage
      const { data: material, error: fetchError } = await supabase
        .from('materials')
        .select('file_path')
        .eq('id', materialId)
        .single();

      if (fetchError) throw fetchError;

      // Deletar arquivo do storage
      const { error: storageError } = await supabase.storage
        .from('eml-materials')
        .remove([material.file_path]);

      if (storageError) throw storageError;

      // Deletar registro do banco
      const { error: deleteError } = await supabase
        .from('materials')
        .delete()
        .eq('id', materialId);

      if (deleteError) throw deleteError;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Material removido com sucesso!' })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Método não permitido' })
  };
};