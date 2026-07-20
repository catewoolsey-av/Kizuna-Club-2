import React, { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabaseClient";
import { colors } from "../../constants/theme";
import { Card, Button, Input, TextArea, Toast } from "../ui";
import { Mail, Phone, ExternalLink, Briefcase, MapPin, Edit, X, Save } from 'lucide-react';

const ProfileView = ({ t, userProfile, setUserProfile, setData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Use isManager from userProfile directly
  const isLeadership = userProfile?.isManager === true;
  
  const [form, setForm] = useState({
    name: userProfile?.name || userProfile?.nameEn || '',
    title: userProfile?.title || '',
    company: userProfile?.company || '',
    phone: userProfile?.phone || '',
    linkedin: userProfile?.linkedin || '',
    location: userProfile?.location || '',
    bio: userProfile?.bio || '',
    notableInvestments: userProfile?.notableInvestments || '',
    interests: userProfile?.interests?.join(', ') || ''
  });

  // Sync form with userProfile when it changes
  useEffect(() => {
    if (userProfile) {
      setForm({
        name: userProfile.name || userProfile.nameEn || '',
        title: userProfile.title || '',
        company: userProfile.company || '',
        phone: userProfile.phone || '',
        linkedin: userProfile.linkedin || '',
        location: userProfile.location || '',
        bio: userProfile.bio || '',
        notableInvestments: userProfile.notableInvestments || '',
        interests: userProfile.interests?.join(', ') || ''
      });
    }
  }, [userProfile]);

  const profile = userProfile || { name: 'User', title: 'Member', email: 'user@example.com' };
  const initials = (form.name || profile.name || 'U').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
  
  const handleSave = async () => {
    setSaving(true);
    try {
      // Determine which table the user is in
      const tableName = isLeadership ? 'leadership' : 'members';

      // Build update object based on user type
      let updates;
      if (isLeadership) {
        // Leadership fields: name, title, email, company, location, phone, linkedin, bio, notable_investments
        updates = {
          name: form.name,
          title: form.title,
          company: form.company,
          location: form.location,
          phone: form.phone,
          linkedin: form.linkedin,
          bio: form.bio,
          notable_investments: form.notableInvestments
        };
      } else {
        // Member fields: name, email, company, location, interests
        updates = {
          name: form.name,
          company: form.company,
          location: form.location,
          interests: form.interests ? form.interests.split(',').map(i => i.trim()) : []
        };
      }

      // Update in the correct table
      const matchColumn = profile.id ? 'id' : 'email';
      const matchValue = profile.id || profile.email;
      if (!matchValue) {
        throw new Error('Missing profile identifier for update.');
      }
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updates)
        .eq(matchColumn, matchValue);

      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`);
      }

      // Update local state immediately
      if (setUserProfile) {
        setUserProfile(prev => ({
          ...prev,
          name: form.name,
          nameEn: form.name,
          ...(isLeadership ? {
            title: form.title,
            company: form.company,
            location: form.location,
            phone: form.phone,
            linkedin: form.linkedin,
            bio: form.bio,
            notableInvestments: form.notableInvestments
          } : {
            company: form.company,
            location: form.location,
            interests: form.interests ? form.interests.split(',').map(i => i.trim()) : []
          })
        }));
      }

      // IMPORTANT: Also update the data.leadership or data.members array
      // This ensures Dashboard and other components see the updated name
      if (setData) {
        setData(prev => {
          if (isLeadership) {
            // Update leadership array
            return {
              ...prev,
              leadership: (prev.leadership || []).map(leader => 
                leader.id === userProfile.id 
                  ? { 
                      ...leader, 
                      name: form.name,
                      nameEn: form.name,
                      title: form.title,
                      company: form.company,
                      location: form.location,
                      phone: form.phone,
                      linkedin: form.linkedin,
                      bio: form.bio,
                      notable_investments: form.notableInvestments,
                      notableInvestments: form.notableInvestments
                    }
                  : leader
              )
            };
          } else {
            // Update members array
            return {
              ...prev,
              members: (prev.members || []).map(member =>
                member.id === userProfile.id
                  ? {
                      ...member,
                      name: form.name,
                      nameEn: form.name,
                      company: form.company,
                      location: form.location,
                      interests: form.interests ? form.interests.split(',').map(i => i.trim()) : []
                    }
                  : member
              )
            };
          }
        });
      }

      setToast({ message: 'Profile updated successfully!', type: 'success' });
      setIsEditing(false);
    } catch (err) {
      setToast({ message: `Error: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: userProfile?.name || userProfile?.nameEn || '',
      title: userProfile?.title || '',
      company: userProfile?.company || '',
      phone: userProfile?.phone || '',
      linkedin: userProfile?.linkedin || '',
      location: userProfile?.location || '',
      bio: userProfile?.bio || '',
      notableInvestments: userProfile?.notableInvestments || '',
      interests: userProfile?.interests?.join(', ') || ''
    });
    setIsEditing(false);
  };
  
  return (
    <div className="max-w-2xl mx-auto pt-24">
      <Card>
        <div className="flex items-center gap-6 mb-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-medium" style={{ backgroundColor: colors.primary }}>
            {initials}
          </div>
          <div>
            {isEditing ? (
              <Input
                label="Name"
                value={form.name}
                onChange={(val) => setForm({ ...form, name: val })}
                placeholder="Your name"
              />
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900">{form.name}</h2>
                <p className="text-gray-600">{isLeadership ? form.title : 'Member'}</p>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Email - Read only, both */}
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-gray-400" />
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="text-gray-900">{profile.email}</p>
            </div>
          </div>

          {/* LEADERSHIP FIELDS */}
          {isLeadership && (
            <>
              {/* Title */}
              {isEditing ? (
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(val) => setForm({ ...form, title: val })}
                  placeholder="Your title"
                />
              ) : form.title && (
                <div className="flex items-center gap-3">
                  <Briefcase size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Title</p>
                    <p className="text-gray-900">{form.title}</p>
                  </div>
                </div>
              )}

              {/* Company */}
              {isEditing ? (
                <Input
                  label="Company"
                  value={form.company}
                  onChange={(val) => setForm({ ...form, company: val })}
                  placeholder="Your company"
                />
              ) : form.company && (
                <div className="flex items-center gap-3">
                  <Briefcase size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Company</p>
                    <p className="text-gray-900">{form.company}</p>
                  </div>
                </div>
              )}

              {/* Location */}
              {isEditing ? (
                <Input
                  label="Location"
                  value={form.location}
                  onChange={(val) => setForm({ ...form, location: val })}
                  placeholder="Your location"
                />
              ) : form.location && (
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-gray-900">{form.location}</p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {isEditing ? (
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(val) => setForm({ ...form, phone: val })}
                  placeholder="Your phone number"
                />
              ) : form.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="text-gray-900">{form.phone}</p>
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {isEditing ? (
                <Input
                  label="LinkedIn"
                  value={form.linkedin}
                  onChange={(val) => setForm({ ...form, linkedin: val })}
                  placeholder="LinkedIn profile URL"
                />
              ) : form.linkedin && (
                <div className="flex items-center gap-3">
                  <ExternalLink size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">LinkedIn</p>
                    <a href={form.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View Profile</a>
                  </div>
                </div>
              )}

              {/* Bio */}
              {isEditing ? (
                <TextArea
                  label="Bio"
                  value={form.bio}
                  onChange={(val) => setForm({ ...form, bio: val })}
                  placeholder="Tell us about yourself"
                  rows={3}
                />
              ) : form.bio && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">About</p>
                  <p className="text-gray-900 whitespace-pre-wrap">{form.bio}</p>
                </div>
              )}

              {/* Notable Investments */}
              {isEditing ? (
                <TextArea
                  label="Notable Investments"
                  value={form.notableInvestments}
                  onChange={(val) => setForm({ ...form, notableInvestments: val })}
                  placeholder="e.g., Sequoia Capital, SoftBank Vision Fund, Goldman Sachs"
                  rows={2}
                />
              ) : form.notableInvestments && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Notable Investments</p>
                  <p className="text-gray-900">{form.notableInvestments}</p>
                </div>
              )}
            </>
          )}

          {/* MEMBER FIELDS */}
          {!isLeadership && (
            <>
              {/* Company */}
              {isEditing ? (
                <Input
                  label="Company"
                  value={form.company}
                  onChange={(val) => setForm({ ...form, company: val })}
                  placeholder="Your company"
                />
              ) : form.company && (
                <div className="flex items-center gap-3">
                  <Briefcase size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Company</p>
                    <p className="text-gray-900">{form.company}</p>
                  </div>
                </div>
              )}

              {/* Location */}
              {isEditing ? (
                <Input
                  label="Location"
                  value={form.location}
                  onChange={(val) => setForm({ ...form, location: val })}
                  placeholder="Your location"
                />
              ) : form.location && (
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="text-gray-900">{form.location}</p>
                  </div>
                </div>
              )}

              {/* Interests */}
              {isEditing ? (
                <Input
                  label="Interests (comma separated)"
                  value={form.interests}
                  onChange={(val) => setForm({ ...form, interests: val })}
                  placeholder="AI, FinTech, Healthcare"
                />
              ) : form.interests && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Investment Interests</p>
                  <p className="text-gray-900">{form.interests}</p>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-100 flex gap-3">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                icon={X}
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                icon={Save}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button 
              variant="primary" 
              icon={Edit}
              onClick={() => setIsEditing(true)}
            >
              Edit Profile
            </Button>
          )}
        </div>
      </Card>

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default ProfileView;
