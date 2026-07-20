const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  
  const { email, password, memberId, isLeader } = JSON.parse(event.body);
  
  // Validate inputs
  if (!email || !password || !memberId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }
  
  // Create Supabase client with SERVICE ROLE KEY (server-side only!)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true // Auto-confirm so they can log in immediately
    });
    
    if (authError) throw authError;
    
    console.log('Created auth user:', authData.user.id);
    
    // Link to member or leadership record based on isLeader flag
    const tableName = isLeader ? 'leadership' : 'members';
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ 
        auth_user_id: authData.user.id,
        must_change_password: true // Force password change on first login
      })
      .eq('id', memberId);
    
    if (updateError) throw updateError;
    
    console.log(`Linked ${isLeader ? 'leader' : 'member'}:`, memberId);
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        userId: authData.user.id 
      })
    };
    
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};