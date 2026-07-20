import React, { useEffect, useState } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { colors } from '../../constants/theme';
import { Button, Input } from '../ui';
import { supabase } from '../../lib/supabaseClient';

export const LoginModal = ({ isOpen, onClose, t, inline = false, onPasswordChangeStart, onPasswordChangeComplete, onLoginSuccess, onMfaRequired, memberNeedingPasswordChange, passwordChangeInProgress }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showMfaStep, setShowMfaStep] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [mfaEmail, setMfaEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Password change state - use internal state for form fields only
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    sessionStorage.setItem('kizuna_mfa_password_phase', 'true');
    sessionStorage.setItem('kizuna_mfa_link_sent', 'false');
    if (onMfaRequired) onMfaRequired(true);
    
    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password
      });
      
      if (authError) {
        sessionStorage.setItem('kizuna_mfa_password_phase', 'false');
        sessionStorage.setItem('kizuna_mfa_link_sent', 'false');
        if (onMfaRequired) onMfaRequired(false);
        if (authError.message.includes('Invalid login credentials')) {
          setError('Incorrect email or password');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }
      
      // Get member record linked to this auth user - check members first
      const { data: member, error: memberError } = await supabase
        .from('members')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single();
      
      let userRecord = null;
      
      if (member) {
        userRecord = member;
      } else {
        // Not in members, try leadership table
        const { data: leader, error: leaderError } = await supabase
          .from('leadership')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .single();
        
        if (leader) {
          userRecord = leader;
        }
      }
      
      // If not found in either table, error out
      if (!userRecord) {
        sessionStorage.setItem('kizuna_mfa_password_phase', 'false');
        sessionStorage.setItem('kizuna_mfa_link_sent', 'false');
        if (onMfaRequired) onMfaRequired(false);
        setError('Account record not found. Please contact your administrator.');
        await supabase.auth.signOut(); // Clean up auth session
        setLoading(false);
        return;
      }
      
      // Check if password change required
      console.log('🔍 Checking password change requirement...');
      console.log('   userRecord:', userRecord);
      console.log('   must_change_password:', userRecord.must_change_password);
      
      if (userRecord.must_change_password) {
        sessionStorage.setItem('kizuna_mfa_password_phase', 'false');
        sessionStorage.setItem('kizuna_mfa_link_sent', 'false');
        if (onMfaRequired) onMfaRequired(false);
        console.log('✅ Password change IS required - showing password change form');
        console.log('   Calling onPasswordChangeStart with member:', userRecord);
        if (onPasswordChangeStart) onPasswordChangeStart(userRecord);
        setLoading(false);
        return;
      }
      
      console.log('✅ Password verified - moving to MFA magic link step');
      await supabase.auth.signOut();
      sessionStorage.setItem('kizuna_mfa_password_phase', 'false');
      setMfaEmail(email.toLowerCase().trim());
      setMagicLinkSent(false);
      setShowMfaStep(true);
      
    } catch (err) {
      sessionStorage.setItem('kizuna_mfa_password_phase', 'false');
      sessionStorage.setItem('kizuna_mfa_link_sent', 'false');
      if (onMfaRequired) onMfaRequired(false);
      setError('Error logging in. Please try again.');
      console.error(err);
    }
    
    setLoading(false);
  };

  const handleSendMagicLink = async () => {
    if (resendCooldown > 0) {
      setError(`Please wait ${resendCooldown}s before requesting another link.`);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: mfaEmail,
        options: {
          emailRedirectTo: `${window.location.origin}?mfa=1`
        }
      });
      
      if (otpError) throw otpError;
      sessionStorage.setItem('kizuna_mfa_link_sent', 'true');
      setMagicLinkSent(true);
      setResendCooldown(60);
    } catch (err) {
      if (err?.status === 429 || (err?.message || '').toLowerCase().includes('rate limit')) {
        setResendCooldown(60);
        setError('Email rate limit exceeded. Please wait 60 seconds before trying again.');
      } else {
        setError('Error sending magic link. Please try again.');
      }
      console.error(err);
    }
    
    setLoading(false);
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (updateError) throw updateError;
      
      // Update must_change_password flag in the correct table
      // First try members table
      const { data: memberCheck } = await supabase
        .from('members')
        .select('id')
        .eq('id', memberNeedingPasswordChange.id)
        .single();
      
      if (memberCheck) {
        // Update in members table
        const { error: memberError } = await supabase
          .from('members')
          .update({ must_change_password: false })
          .eq('id', memberNeedingPasswordChange.id);
        
        if (memberError) throw memberError;
      } else {
        // Update in leadership table
        const { error: leaderError } = await supabase
          .from('leadership')
          .update({ must_change_password: false })
          .eq('id', memberNeedingPasswordChange.id);
        
        if (leaderError) throw leaderError;
      }
      
      // Success! Close modal
      if (onPasswordChangeComplete) onPasswordChangeComplete();
      onClose();
      
    } catch (err) {
      setError('Error updating password. Please try again.');
      console.error(err);
    }
    
    setLoading(false);
  };
  
  if (!isOpen) return null;
  
  // Forgot password view
  if (showForgotPassword) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={() => setShowForgotPassword(false)}
      >
        <div
          className="bg-white rounded-xl max-w-sm w-full p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Lock size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700 mb-2">
              To reset your password, please email:
            </p>
            <p className="text-sm font-medium text-gray-900">
              cate.woolsey@av.vc
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Include your name and registered email address.
            </p>
          </div>
          
          <Button variant="outline" className="w-full" onClick={() => setShowForgotPassword(false)}>
            Back to Login
          </Button>
        </div>
      </div>
    );
  }
  
  // Password change view
  if (passwordChangeInProgress && memberNeedingPasswordChange) {
    return (
      <div
        className={
          inline
            ? "w-full flex justify-center"
            : "fixed inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center z-50 p-4"
        }
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <div
          className="bg-white rounded-xl max-w-sm w-full p-6"
          onClick={inline ? undefined : (e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Lock size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Create Your Password</h2>
              <p className="text-sm text-gray-500">Please set a new password to continue</p>
            </div>
          </div>
          
          <form onSubmit={handlePasswordChange}>
            <div className="space-y-4 mb-4">
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="At least 6 characters"
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Re-enter your password"
                required
              />
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            
            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Saving...' : 'Set Password & Continue'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (showMfaStep) {
    return (
      <div
        className={inline ? "w-full flex justify-center" : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"}
        onClick={inline ? undefined : onClose}
      >
        <div
          className="bg-white rounded-xl max-w-sm w-full p-6 text-left"
          onClick={inline ? undefined : (e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: colors.accent }}
            >
              <Mail size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Multi-Factor Authentication</h2>
              <p className="text-sm text-gray-500">Send a magic link to continue</p>
            </div>
          </div>
          
          <p className="text-sm text-gray-700 mb-4 text-center">
            We verified your password.
          </p>

          <p className="text-sm text-gray-700 mb-4 text-center">
            Send a magic link to <span className="font-medium">{mfaEmail}</span> to open the portal.
          </p>
          
          {magicLinkSent && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              You may close this tab.
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowMfaStep(false);
                setMagicLinkSent(false);
                sessionStorage.setItem('kizuna_mfa_link_sent', 'false');
                if (onMfaRequired) onMfaRequired(false);
              }}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              onClick={handleSendMagicLink}
              disabled={loading || resendCooldown > 0}
            >
              {loading ? 'Sending...' : (resendCooldown > 0 ? `Retry in ${resendCooldown}s` : (magicLinkSent ? 'Resend Link' : 'Send Magic Link'))}            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Main login view
  return (
    <div
      className={inline ? "w-full flex justify-center" : "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"}
      onClick={inline ? undefined : onClose}
    >
      <div
        className="bg-white rounded-xl max-w-sm w-full p-6 text-left"
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.accent }}
          >
            <Mail size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Welcome to Kizuna Club</h2>
            <p className="text-sm text-gray-500">Sign in to continue</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 mb-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="your@email.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              required
            />
          </div>
          
          <div className="flex justify-end mb-4">
            <button 
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm hover:underline"
              style={{ color: colors.primary }}
            >
              Forgot password?
            </button>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm mb-4">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div className="flex gap-3">
            {!inline && (
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
            )}
            <Button type="submit" variant="primary" className="flex-1" disabled={loading}>
              Sign In
            </Button>
          </div>
        </form>
        
        <p className="text-center text-sm text-gray-500 mt-6">
          <span className="block">New member?</span>
          <span className="block">Contact your club administrator for access.</span>
        </p>
        
        <p className="text-center text-xs text-gray-400 mt-4 px-4">
          <span className="block">This portal contains confidential information.</span>
          <span className="block">By logging in, you agree to maintain confidentiality.</span>
        </p>
      </div>
    </div>
  );
};
