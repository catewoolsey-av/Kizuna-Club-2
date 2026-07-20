const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const { auth_user_id, new_password, isLeader } = JSON.parse(event.body);
  
  if (!auth_user_id || !new_password) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }
  
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      auth_user_id,
      { password: new_password }
    );
    
    if (updateError) throw updateError;
    
    // Set must_change_password flag in the appropriate table
    const tableName = isLeader ? 'leadership' : 'members';
    await supabase
      .from(tableName)
      .update({ must_change_password: true })
      .eq('auth_user_id', auth_user_id);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
    
  } catch (error) {
    console.error('Error resetting password:', error);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};